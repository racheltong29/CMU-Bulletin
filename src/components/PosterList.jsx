// Import React hooks and router utilities
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

// Import Firestore SDK functions and database instance
import { db, getUserDisplayName } from '../firebase';
import { collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

// Import the modal component for poster details
import Modal from './Modal';
import HeartIcon from './HeartIcon';
import { formatEventDateTime } from '../utils/eventDateTime';

// Import Masonry for column layout
import PosterMasonry from './PosterMasonry';
import { filterPosters, findNextOccurrence } from '../utils/filterPosters';
import './PosterList.css';

/**********************************************************************************/

// Build Google Calendar event date/time strings and a share link
// Supports timed events and all-day events. For repeating events we use the
// next occurring date as the event instance.
const toGoogleDateTime = (dateStr, timeStr) => {
  // dateStr expected 'YYYY-MM-DD', timeStr expected 'HH:MM' (24h) or undefined
  if (!dateStr) return null;

  if (!timeStr) {
    // All-day event format: YYYYMMDD (end date should be exclusive)
    const start = dateStr.replace(/-/g, '');
    // End is next day for Google all-day events
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const end = `${year}${month}${day}`;
    return `${start}/${end}`;
  }

  // Timed event: construct local Date then convert to UTC parts
  const local = new Date(`${dateStr}T${timeStr}:00`);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const min = String(local.getUTCMinutes()).padStart(2, '0');
  const ss = '00';
  return `${y}${m}${d}T${hh}${min}${ss}Z`;
};

const createGoogleCalendarLink = (poster) => {
  if (!poster) return null;
  const title = poster.title || 'Event';
  const description = poster.description || '';
  const location = Array.isArray(poster.location) ? poster.location.join(', ') : (poster.location || '');

  // Choose event date: for repeating events prefer next_occurring_date or fallback to finding one
  const today = new Date().toISOString().split('T')[0];
  const eventDate = poster.single_event_date || poster.next_occurring_date || (poster.repeating ? findNextOccurrence(poster, today) : null);
  if (!eventDate) return null;

  // If we have start/end times, create timed event; otherwise all-day
  const hasStart = Boolean(poster.start_time);
  const hasEnd = Boolean(poster.end_time);

  let datesParam = '';
  if (hasStart && hasEnd) {
    const start = toGoogleDateTime(eventDate, poster.start_time);
    const end = toGoogleDateTime(eventDate, poster.end_time);
    // toGoogleDateTime returns strings; for timed events they include 'Z'
    datesParam = `${start}/${end}`;
  } else {
    // All-day event: Google expects YYYYMMDD/YYYYMMDD (end exclusive)
    datesParam = toGoogleDateTime(eventDate, undefined);
  }

  // Add quick note for repeating events so user understands if it was a single instance
  const details = poster.repeating ? `${description}\n\n(Recurring: ${poster.frequency || 'repeating'})` : description;

  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', title);
  params.set('dates', datesParam);
  if (details) params.set('details', details);
  if (location) params.set('location', location);

  return `https://www.google.com/calendar/render?${params.toString()}`;
};

const toTagList = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const formatTagLabel = (tag) => tag.charAt(0).toUpperCase() + tag.slice(1);

const formatLocation = (location) => {
  if (!location) return '';
  return Array.isArray(location) ? location.join(', ') : location;
};

const getOrganizerName = (poster, uploaderNames) =>
  poster.organizer || uploaderNames[poster.uploaded_by] || 'Unknown';

const getPosterDateTime = (poster) => {
  if (poster.repeating) {
    const today = new Date().toISOString().split('T')[0];
    const nextDate = poster.next_occurring_date || findNextOccurrence(poster, today);
    if (!nextDate) return null;
    return formatEventDateTime(
      nextDate,
      poster.event_time || poster.single_event_time,
      poster.single_event_time_end
    );
  }

  if (!poster.single_event_date) return null;
  return formatEventDateTime(
    poster.single_event_date,
    poster.single_event_time,
    poster.single_event_time_end
  );
};

function PosterListCard({ poster, user, likedPosters, onOpen, onLikeToggle, uploaderNames, renderActions }) {
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (copiedTimeoutRef.current) {
      window.clearTimeout(copiedTimeoutRef.current);
    }
  }, []);

  const handleShare = async (event) => {
    event.stopPropagation();
    const shareUrl = `${window.location.origin}/poster/${poster.id}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copiedTimeoutRef.current) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const categoryPills = toTagList(poster.category).map((cat) => ({
    key: `category-${cat}`,
    label: formatTagLabel(cat),
  }));
  const tagPills = (poster.tags || []).map((tag) => ({
    key: `tag-${tag}`,
    label: tag,
  }));
  const combinedPills = [...categoryPills, ...tagPills].slice(0, 4);
  const extraPillCount = categoryPills.length + tagPills.length - combinedPills.length;
  const dateTime = getPosterDateTime(poster);
  const locationText = formatLocation(poster.location);

  return (
    <li>
      <article
        className={`poster-list-card${renderActions ? ' poster-list-card--with-profile-actions' : ''}`}
        onClick={() => onOpen(poster)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(poster);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`View details for ${poster.title}`}
      >
        <div className="poster-list-card__thumb">
          <img src={poster.image_url} alt="" loading="lazy" />
        </div>

        <div className="poster-list-card__body">
          <div className="poster-list-card__header">
            <h3 className="poster-list-card__title">{poster.title}</h3>
            <div className="poster-list-card__header-actions">
              <div className="poster-list-card__share-wrap">
                <button
                  type="button"
                  className="poster-list-card__share"
                  aria-label={copied ? 'Link copied' : 'Copy link to poster'}
                  onClick={handleShare}
                >
                  <img src="/share-icon.svg" alt="" />
                </button>
                {copied && (
                  <div className="poster-list-card__share-toast" role="status" aria-live="polite">
                    Link copied!
                  </div>
                )}
              </div>
              {user && (
                <button
                  type="button"
                  className="poster-list-card__like"
                  aria-label={likedPosters.includes(poster.id) ? 'Unlike poster' : 'Like poster'}
                  onClick={(event) => {
                    event.stopPropagation();
                    onLikeToggle(poster.id);
                  }}
                >
                  <HeartIcon
                    filled={likedPosters.includes(poster.id)}
                    style={{ width: '18px', height: '18px', pointerEvents: 'none' }}
                  />
                </button>
              )}
            </div>
          </div>

          <p className="poster-list-card__organizer">{getOrganizerName(poster, uploaderNames)}</p>

          <div className="poster-list-card__meta">
            {dateTime && (
              <div className="align-icon">
                <img src="/time-icon.svg" alt="" />
                <span>{dateTime}</span>
              </div>
            )}
            {locationText && (
              <div className="align-icon">
                <img src="/location-icon.svg" alt="" />
                <span>{locationText}</span>
              </div>
            )}
          </div>

          {poster.repeating && (
            <p className="poster-list-card__recurring">
              Recurring{poster.frequency ? ` · ${poster.frequency}` : ''}
            </p>
          )}

          {poster.description && (
            <p className="poster-list-card__description">{poster.description}</p>
          )}

          {combinedPills.length > 0 && (
            <div className="poster-list-card__tags">
              {combinedPills.map((pill) => (
                <span key={pill.key} className="poster-list-card__tag">
                  {pill.label}
                </span>
              ))}
              {extraPillCount > 0 && (
                <span className="poster-list-card__tag">+{extraPillCount}</span>
              )}
            </div>
          )}
        </div>
        {renderActions && (
          <div className="profile-poster-actions profile-poster-actions--grid">
            {renderActions(poster)}
          </div>
        )}
      </article>
    </li>
  );
}


/**********************************************************************************/


// =====================================================
// Main Component: PosterList
// =====================================================
function PosterList({ filterDate, filterLocations, filterTags, searchQuery, user, viewMode }) {
  // Local state variables
  const [allPosters, setAllPosters] = useState([]);         // All posters fetched from DB
  const [filteredPosters, setFilteredPosters] = useState([]); // Posters after applying filters
  const [selectedPoster, setSelectedPoster] = useState(null); // Poster currently shown in modal
  const [likedPosters, setLikedPosters] = useState([]);       // IDs of posters liked by user
  const [uploaderNames, setUploaderNames] = useState({});     // Map of poster uploader IDs → names
  const { category, id: sharePosterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isShareRoute = location.pathname.startsWith('/poster/');
  const filterCategory = isShareRoute ? 'All' : (category || 'All');

  useEffect(() => {
    if (!isShareRoute || !sharePosterId) return undefined;

    const loadSharedPoster = async () => {
      const docSnap = await getDoc(doc(db, 'posters', sharePosterId));
      if (!docSnap.exists()) {
        navigate('/', { replace: true });
        return;
      }

      const poster = {
        id: docSnap.id,
        ...docSnap.data(),
      };
      poster.googleCalUrl = createGoogleCalendarLink(poster);
      setSelectedPoster(poster);
    };

    loadSharedPoster();
  }, [isShareRoute, sharePosterId, navigate]);

  // --------------------------------------------
  // Fetch posters in real time from Firestore
  // --------------------------------------------
  useEffect(() => {
    const q = query(collection(db, 'posters'));

    // Subscribe to Firestore snapshot updates
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Convert snapshot docs into JS objects
      const postersData = snapshot.docs.map((doc) => {
        const poster = {
          id: doc.id,
          ...doc.data(),
        };
        // Canonical calendar URL property used across the app
        const calUrl = createGoogleCalendarLink(poster);
        poster.googleCalUrl = calUrl;
        return poster;
      })
      // Sort by event date, then creation date
      .sort((a, b) => {
        const dateA = a.sort_date || (a.repeating ? a.next_occurring_date : a.single_event_date);
        const dateB = b.sort_date || (b.repeating ? b.next_occurring_date : b.single_event_date);
        const compareDates = new Date(dateA) - new Date(dateB);
        if (compareDates !== 0) return compareDates;

        // Secondary sort: by creation timestamp
        const createdAtA = a.created_at ? a.created_at.toDate() : new Date(0);
        const createdAtB = b.created_at ? b.created_at.toDate() : new Date(0);
        return createdAtA - createdAtB;
      });

      setAllPosters(postersData);

      // Resolve uploader names (from organizer field or users collection)
      const names = {};
      for (const poster of postersData) {
        if (poster.organizer) {
          names[poster.id] = poster.organizer;
        } else if (poster.uploaded_by && !names[poster.uploaded_by]) {
          const userDoc = await getDoc(doc(db, 'users', poster.uploaded_by));
          if (userDoc.exists()) {
            names[poster.uploaded_by] = getUserDisplayName(userDoc.data());
          }
        }
      }
      setUploaderNames(names);
    });

    // Cleanup Firestore listener on unmount
    return () => unsubscribe();
  }, []);

  // --------------------------------------------
  // Listen for liked posters for current user
  // --------------------------------------------
  useEffect(() => {
    if (user) {
      const likedRef = collection(db, `users/${user.uid}/likedPosters`);
      const unsubscribeLiked = onSnapshot(likedRef, (snapshot) => {
        setLikedPosters(snapshot.docs.map(doc => doc.id)); // Store liked poster IDs
      });
      return () => unsubscribeLiked();
    } else {
      setLikedPosters([]); // If user logged out, reset likes
    }
  }, [user]);

  // --------------------------------------------
  // Like/Unlike button handler
  // --------------------------------------------
  const handleLikeToggle = async (posterId) => {
    console.log('handleLikeToggle called for posterId:', posterId);
    if (!user) {
      alert('Please sign in to like posters.');
      return;
    }

    const likedRef = doc(db, `users/${user.uid}/likedPosters`, posterId);
    if (likedPosters.includes(posterId)) {
      // If already liked, remove the like
      console.log('Unliking poster:', posterId);
      await deleteDoc(likedRef);
    } else {
      // Otherwise, add a like
      console.log('Liking poster:', posterId);
      await setDoc(likedRef, {}); // Empty object (we only care about the doc ID)
    }

    console.log('Current likedPosters after toggle:', likedPosters);
  };

  // --------------------------------------------
  // Filter posters by date, category, tags, etc.
  // --------------------------------------------
  useEffect(() => {
    setFilteredPosters(
      filterPosters(allPosters, {
        filterCategory,
        filterDate,
        filterLocations,
        filterTags,
        searchQuery,
      })
    );
  }, [filterCategory, allPosters, filterDate, searchQuery, filterLocations, filterTags]);

  // --------------------------------------------
  // Modal open/close handlers
  // --------------------------------------------
  const handlePosterClick = (poster) => {
    setSelectedPoster(poster);
  };

  const handleCloseModal = () => {
    setSelectedPoster(null);
    if (isShareRoute) {
      navigate('/', { replace: true });
    }
  };

  // --------------------------------------------
  // JSX Render: Poster Grid
  // --------------------------------------------
  return (
  <div>
    {/* Render Posters Based on the Current View Mode */}
    {viewMode === 'grid' ? (
      filteredPosters.length === 0 ? (
        <div className="empty-state">
          <h2>No posters yet.</h2>
          <p>Be the first to share something!</p>
        </div>
      ) : (
        <PosterMasonry
          posters={filteredPosters}
          renderPoster={(poster, registerHeight) => (
            <div key={poster.id} className="poster-card">
              <img
                src={poster.image_url}
                alt={poster.title}
                onClick={() => handlePosterClick(poster)}
                onLoad={(e) =>
                  registerHeight(poster.id, e.target.naturalWidth, e.target.naturalHeight)
                }
              />
            </div>
          )}
        />
      )
    ) : (
      filteredPosters.length === 0 ? (
        <div className="empty-state">
          <h2>No posters yet.</h2>
          <p>Be the first to share something!</p>
        </div>
      ) : (
        <ul className="poster-list">
          {filteredPosters.map((poster) => (
            <PosterListCard
              key={poster.id}
              poster={poster}
              user={user}
              likedPosters={likedPosters}
              onOpen={handlePosterClick}
              onLikeToggle={handleLikeToggle}
              uploaderNames={uploaderNames}
            />
          ))}
        </ul>
      )
    )}
    
    {/* Modal handling */}
      {selectedPoster && (
        <Modal
          poster={selectedPoster}
          onClose={handleCloseModal}
          user={user}
          likedPosters={likedPosters}
          handleLikeToggle={handleLikeToggle}
          uploaderName={uploaderNames[selectedPoster.uploaded_by]}
        />
      )}
    </div>
  );
}

// Export component
export { PosterListCard };
export default PosterList;
