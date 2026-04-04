// Import React hooks and router utilities
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

// Import Firestore SDK functions and database instance
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

// Import the modal component for poster details
import Modal from './Modal';

// Import Masonry for column layout
// npm install react-masonry-css
// if stuff breaks bc not installed
import Masonry from "react-masonry-css";
import { posterImgSrc } from '../posterImage';

/*================================================================================
Helper Function #1: Check if a recurring event occurs on a given date
================================================================================*/
const isRecurringEventOnDate = (poster, checkDateString) => {
  // If it's not a repeating event or missing the recurrence start, it can't recur
  if (!poster.repeating || !poster.next_occurring_date) {
    return false;
  }

  // Construct date objects safely by adding T00:00:00 to avoid timezone errors
  const checkDate = new Date(`${checkDateString}T00:00:00`);
  const startDate = new Date(`${poster.next_occurring_date}T00:00:00`);

  // Event can't occur before its start date
  if (checkDate < startDate) {
    return false;
  }

  const frequency = poster.frequency; // e.g. "daily", "weekly", etc.
  const daysOfWeek = poster.days_of_week || []; // e.g. ['Monday', 'Wednesday']
  const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const checkDayName = dayMap[checkDate.getDay()]; // Convert date to weekday string

  // If event specifies which weekdays it happens on, ensure this day is one of them
  if (daysOfWeek.length > 0 && !daysOfWeek.includes(checkDayName)) {
    return false;
  }

  // Determine recurrence by frequency type
  switch (frequency) {
    case 'daily':
      return true; // Happens every day

    case 'weekly':
      return true; // Weekly recurrence, day-of-week check already handled

    case 'bi-weekly': {
      // Compute how many weeks apart the dates are and ensure it's an even multiple of 2
      const weekStartForStartDate = new Date(startDate.getTime());
      weekStartForStartDate.setDate(startDate.getDate() - startDate.getDay());
      weekStartForStartDate.setHours(0, 0, 0, 0);

      const weekStartForCheckDate = new Date(checkDate.getTime());
      weekStartForCheckDate.setDate(checkDate.getDate() - checkDate.getDay());
      weekStartForCheckDate.setHours(0, 0, 0, 0);

      const weekDiff = Math.round((weekStartForCheckDate - weekStartForStartDate) / (1000 * 60 * 60 * 24 * 7));

      return weekDiff % 2 === 0; // Occurs every other week
    }

    case 'monthly':
      // Occurs on the same date of the month (e.g. every 15th)
      return startDate.getDate() === checkDate.getDate();

    default:
      return false;
  }
};

// =====================================================
// Helper Function #2: Find next occurrence of a recurring event
// =====================================================
const findNextOccurrence = (poster, fromDateString) => {
  if (!poster.repeating || !poster.next_occurring_date) {
    return null;
  }

  const fromDate = new Date(`${fromDateString}T00:00:00`);
  const startDate = new Date(`${poster.next_occurring_date}T00:00:00`);

  // Start checking from the later of fromDate or event start
  let checkDate = new Date(Math.max(fromDate.getTime(), startDate.getTime()));

  // Limit search to within 1 year (avoid infinite loops)
  const searchLimit = new Date(fromDate);
  searchLimit.setFullYear(searchLimit.getFullYear() + 1);

  while (checkDate <= searchLimit) {
    const checkDateFormatted = checkDate.toISOString().split('T')[0];
    if (isRecurringEventOnDate(poster, checkDateFormatted)) {
      return checkDateFormatted;
    }
    // Increment day by 1 and continue checking
    checkDate.setDate(checkDate.getDate() + 1);
  }

  return null; // No next date found within limit
};

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


// masonry testing stuff!
const breakpointColumnsObj = {
  default: 4,
  1200: 3,
  800: 2,
  500: 1
};

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
  const { category } = useParams(); // Category from URL (e.g. "/category/music")

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
            names[poster.uploaded_by] = `${userDoc.data().firstName} ${userDoc.data().lastName}`;
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
    const filterCategory = category || 'All';
    let currentPosters = allPosters;

    // Exclude past events unless a specific filterDate is selected
    if (!filterDate) {
      const today = new Date().toISOString().split('T')[0];
      currentPosters = allPosters.filter(poster => {
        if (poster.repeating) {
          return findNextOccurrence(poster, today) !== null;
        } else {
          return poster.single_event_date >= today;
        }
      });
    }

    // Filter by category
    if (filterCategory !== 'All') {
      currentPosters = currentPosters.filter(poster =>
        poster.category && poster.category.includes(filterCategory)
      );
    }

    // Filter by date (if selected)
    if (filterDate) {
      currentPosters = currentPosters.filter(poster => {
        if (poster.repeating) {
          return isRecurringEventOnDate(poster, filterDate);
        } else {
          return poster.single_event_date === filterDate;
        }
        
      });
    }

    // Filter by search query (title or description)
    if (searchQuery) {
      currentPosters = currentPosters.filter(poster =>
        poster.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        poster.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by selected locations
    if (filterLocations.length > 0) {
      currentPosters = currentPosters.filter(poster =>
        filterLocations.some(location =>
          poster.location.map(l => l.toLowerCase()).includes(location.toLowerCase())
        )
      );
    }

    // Filter by selected tags
    if (filterTags.length > 0) {
      currentPosters = currentPosters.filter(poster =>
        filterTags.some(tag =>
          poster.tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
        )
      );
    }

    console.log("DEBUG: Final Filtered Poster List:", currentPosters);

    // Apply final filtered set
    setFilteredPosters(currentPosters);
  }, [category, allPosters, filterDate, searchQuery, filterLocations, filterTags]);

  // --------------------------------------------
  // Modal open/close handlers
  // --------------------------------------------
  const handlePosterClick = (poster) => {
    setSelectedPoster(poster);
  };

  const handleCloseModal = () => {
    setSelectedPoster(null);
  };

  // --------------------------------------------
  // JSX Render: Poster Grid
  // --------------------------------------------
  return (
  <div>
    {/* Render Posters Based on the Current View Mode */}
    {viewMode === 'grid' ? ( 
      <div className="poster-grid">
        {filteredPosters.length === 0 ? (
          <div className="empty-state">
            <h2>No posters yet.</h2>
            <p>Be the first to share something!</p>
          </div>
        ) : (
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="poster-masonry"
            columnClassName="poster-masonry-column"
          >
            {filteredPosters.map((poster) => (
              <div key={poster.id} className="poster-card">
                <img
                  src={posterImgSrc(poster)}
                  alt={poster.title}
                  onClick={() => handlePosterClick(poster)}
                />
              </div>
            ))}
          </Masonry>
        )}
      </div>
    ) : (
      <ul className="poster-list">
        {filteredPosters.length === 0 ? (
          <div className="empty-state">
            <h2>No posters yet.</h2>
            <p>Be the first to share something!</p>
          </div>
        ) : (
          filteredPosters.map((poster) => (
            <li key={poster.id} className="poster-item" onClick={() => handlePosterClick(poster)}>
              <div className="poster-item-content">
                <img src={posterImgSrc(poster)} width={50} height={50} alt={poster.title} className="poster-thumbnail" />
                <div className="poster-details">
                  <h3>{poster.title}</h3>
                  <p>{poster.description}</p>
                  Location editing for list view: {poster.location.join(', ')} 
                  
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
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
export default PosterList;
