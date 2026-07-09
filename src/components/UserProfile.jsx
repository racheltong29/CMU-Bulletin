import React, { useState, useEffect, useRef, useMemo } from 'react';
import { auth, db, getUserDisplayName } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import EditProfileModal from './EditProfileModal';
import PosterMasonry from './PosterMasonry';
import PosterFilters from './PosterFilters';
import { PosterListCard } from './PosterList';
import { filterPosters } from '../utils/filterPosters';
import './PosterList.css';
import './UserProfile.css';

function UserProfile({ searchQuery, setSearchQuery, availableTags }) {
  const [userPosts, setUserPosts] = useState([]);
  const [likedPostersData, setLikedPostersData] = useState([]);
  const [selectedPoster, setSelectedPoster] = useState(null);
  const [uploaderName, setUploaderName] = useState('');
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('my-posters');
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [filterDate, setFilterDate] = useState('');
  const [filterLocations, setFilterLocations] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();
  const pageWrapRef = useRef(null);
  const profileInfoRef = useRef(null);

  useEffect(() => {
    const updateGradientHeight = () => {
      const wrap = pageWrapRef.current;
      const card = profileInfoRef.current;
      if (!wrap || !card) return;

      const wrapTop = wrap.getBoundingClientRect().top;
      const cardRect = card.getBoundingClientRect();
      const halfwayPoint = cardRect.top - wrapTop + cardRect.height / 2;
      wrap.style.setProperty('--profile-header-bg-height', `${Math.max(Math.round(halfwayPoint), 0)}px`);
    };

    const scheduleUpdate = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(updateGradientHeight);
      });
    };

    scheduleUpdate();

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (profileInfoRef.current) {
      resizeObserver.observe(profileInfoRef.current);
    }

    window.addEventListener('resize', scheduleUpdate);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [userData, currentUser]);

  useEffect(() => {
    if (currentUser) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (userDoc) => {
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      });

      const q = query(collection(db, 'posters'), where('uploaded_by', '==', currentUser.uid));
      const unsubscribePosts = onSnapshot(q, async (snapshot) => {
        const postsData = snapshot.docs.map((posterDoc) => ({
          id: posterDoc.id,
          ...posterDoc.data(),
        }));
        setUserPosts(postsData);
      });

      const likedRef = collection(db, `users/${currentUser.uid}/likedPosters`);
      const unsubscribeLiked = onSnapshot(likedRef, async (snapshot) => {
        const likedIds = snapshot.docs.map((likedDoc) => likedDoc.id);
        const fetchedLikedPosters = [];
        for (const id of likedIds) {
          const posterDoc = await getDoc(doc(db, 'posters', id));
          if (posterDoc.exists()) {
            fetchedLikedPosters.push({ id: posterDoc.id, ...posterDoc.data() });
          }
        }
        setLikedPostersData(fetchedLikedPosters);
      });

      return () => {
        unsubscribeUser();
        unsubscribePosts();
        unsubscribeLiked();
      };
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedPoster && selectedPoster.uploaded_by) {
      const fetchUploaderName = async () => {
        const userDoc = await getDoc(doc(db, 'users', selectedPoster.uploaded_by));
        if (userDoc.exists()) {
          setUploaderName(getUserDisplayName(userDoc.data()));
        } else {
          setUploaderName('Unknown');
        }
      };
      fetchUploaderName();
    }
  }, [selectedPoster]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDeletePost = async (postId) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await deleteDoc(doc(db, 'posters', postId));
        alert('Post deleted successfully!');
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Error deleting post.');
      }
    }
  };

  const handleEditPost = (postId) => {
    navigate(`/edit-poster/${postId}`);
  };

  const handlePosterClick = (poster) => {
    setSelectedPoster(poster);
  };

  const handleCloseModal = () => {
    setSelectedPoster(null);
  };

  const handleLikeToggle = async (posterId) => {
    if (!currentUser) {
      alert('Please sign in to like posters.');
      return;
    }
    const likedRef = doc(db, `users/${currentUser.uid}/likedPosters`, posterId);
    const isLiked = likedPostersData.some((poster) => poster.id === posterId);

    try {
      if (isLiked) {
        await deleteDoc(likedRef);
      } else {
        await setDoc(likedRef, {});
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      alert('Error toggling like: ' + error.message);
    }
  };

  const toggleViewMode = () => {
    setViewMode((mode) => (mode === 'grid' ? 'list' : 'grid'));
  };

  const renderPosterActions = (poster) => (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleEditPost(poster.id);
        }}
        className="profile-poster-action-btn"
        aria-label="Edit poster"
      >
        <img src="/pen.svg" alt="" />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleDeletePost(poster.id);
        }}
        className="profile-poster-action-btn profile-poster-action-btn--delete"
        aria-label="Delete poster"
      >
        <img src="/trash.svg" alt="" />
      </button>
    </>
  );

  const renderPosterCard = (poster, registerHeight, withActions = false) => (
    <div
      key={poster.id}
      className={`poster-card ${withActions ? 'profile-poster-card' : ''}`}
    >
      <div className="profile-poster-media">
        <img
          src={poster.image_url}
          alt={poster.title}
          onClick={() => handlePosterClick(poster)}
          onLoad={(e) =>
            registerHeight(poster.id, e.target.naturalWidth, e.target.naturalHeight)
          }
        />
        {withActions && (
          <div className="profile-poster-actions profile-poster-actions--grid">
            {renderPosterActions(poster)}
          </div>
        )}
      </div>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="page-content profile-page">
        <h2>Please sign in to view your profile.</h2>
      </div>
    );
  }

  const activePosters = activeTab === 'my-posters' ? userPosts : likedPostersData;
  const filteredPosters = useMemo(
    () =>
      filterPosters(activePosters, {
        filterDate,
        filterLocations,
        filterTags,
        searchQuery: searchQuery || '',
      }),
    [activePosters, filterDate, filterLocations, filterTags, searchQuery]
  );
  const showActions = activeTab === 'my-posters';
  const profilePhotoSrc = userData?.profilePhotoUrl || '/tester-pfp-icon.svg';
  const likedPosterIds = likedPostersData.map((poster) => poster.id);
  const uploaderNames = currentUser
    ? { [currentUser.uid]: getUserDisplayName(userData) }
    : {};

  return (
    <div className="profile-page-wrap" ref={pageWrapRef}>
      <div className="profile-header-bg" aria-hidden="true">
        <div className="profile-header-bg__blob profile-header-bg__blob--1" />
        <div className="profile-header-bg__blob profile-header-bg__blob--2" />
        <div className="profile-header-bg__blob profile-header-bg__blob--3" />
      </div>

      <div className="page-content profile-page">
        <div className="profile-info-card" ref={profileInfoRef}>
          <div className="profile-info-inner">
            <div className="profile-icon">
              <img src={profilePhotoSrc} alt="Profile" />
            </div>

            <div className="profile-text">
              <h2>{getUserDisplayName(userData) || 'User Profile'}</h2>
              {userData?.description && (
                <p className="profile-description">{userData.description}</p>
              )}
              {userData && (
                <>
                  <p><strong>Email:</strong> {currentUser.email}</p>
                  {userData.organization && (
                    <p><strong>Organization:</strong> {userData.organization}</p>
                  )}
                </>
              )}
              <div className="profile-actions">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="profile-edit-btn"
                >
                  Edit profile
                </button>
                <button type="button" onClick={handleSignOut} className="profile-sign-out-btn">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-posts-toolbar">
          <div className="profile-tabs" role="tablist" aria-label="Profile poster views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'my-posters'}
              className={`profile-tab ${activeTab === 'my-posters' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-posters')}
            >
              My Posters
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'liked'}
              className={`profile-tab ${activeTab === 'liked' ? 'active' : ''}`}
              onClick={() => setActiveTab('liked')}
            >
              Liked Posters
            </button>
          </div>

          <PosterFilters
            variant="profile"
            filterDate={filterDate}
            setFilterDate={setFilterDate}
            filterLocations={filterLocations}
            setFilterLocations={setFilterLocations}
            filterTags={filterTags}
            setFilterTags={setFilterTags}
            availableTags={availableTags}
            toggleViewMode={toggleViewMode}
            viewMode={viewMode}
            setSearchQuery={setSearchQuery}
            onResetFilters={() => {}}
            showCategoryBar={false}
          />
        </div>

        <div className="poster-list-wrapper profile-posts-wrapper">
          {activePosters.length === 0 ? (
            <div className="profile-empty-state">
              <p>
                {activeTab === 'my-posters'
                  ? "You haven't posted anything yet."
                  : "You haven't liked any posters yet."}
              </p>
            </div>
          ) : filteredPosters.length === 0 ? (
            <div className="empty-state">
              <h2>No posters match your filters.</h2>
              <p>Try adjusting your filters or search.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <PosterMasonry
              posters={filteredPosters}
              actionExtraWeight={0}
              renderPoster={(poster, registerHeight) =>
                renderPosterCard(poster, registerHeight, showActions)
              }
            />
          ) : (
            <ul className="poster-list">
              {filteredPosters.map((poster) => (
                <PosterListCard
                  key={poster.id}
                  poster={poster}
                  user={currentUser}
                  likedPosters={likedPosterIds}
                  onOpen={handlePosterClick}
                  onLikeToggle={handleLikeToggle}
                  uploaderNames={uploaderNames}
                  renderActions={showActions ? renderPosterActions : undefined}
                />
              ))}
            </ul>
          )}
        </div>

        {selectedPoster && (
          <Modal
            poster={selectedPoster}
            onClose={handleCloseModal}
            user={currentUser}
            likedPosters={likedPosterIds}
            handleLikeToggle={handleLikeToggle}
            uploaderName={uploaderName}
          />
        )}

        {isEditProfileOpen && (
          <EditProfileModal
            userData={userData}
            onClose={() => setIsEditProfileOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default UserProfile;
