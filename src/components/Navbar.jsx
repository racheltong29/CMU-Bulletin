import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

function Navbar({ user, searchQuery, setSearchQuery }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const toggleDropdown = () => setIsOpen(!isOpen);  

  const isProfilePage = location.pathname === '/profile';
  const isAuthPage = location.pathname === '/authsignup' || location.pathname === '/authlogin';

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  return (
    <header>
      <div className="page-content navbar-content">
        <div className="top-bar">
        <div className="title-logo"> 
          <Link to="/" className="logo-button-link">
            <img src="/logo-small.svg" alt="CMU Logo" />
            <h1 className="website-title">
              CMU <br/> Bulletin
            </h1>
          </Link>
        </div>

        <div className = "search-bar">
          <img src="/search-icon.svg" alt="Search" className="search-icon" />
          
          <input
            type="text"
            placeholder="Search for events, information..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div> 
        

        <div className="nav-buttons-container">
          {user ? (
            <>
              <Link to="/post" className="createbtn nav-create-btn">
                <img src="/plus-icon.svg" alt="" aria-hidden="true" />
                <span>Create</span>
              </Link>

              <div className="nav-icon-group">
                <button type="button" className="nav-icon-btn" aria-label="Liked posters">
                  <img src="/heart-icon.svg" alt="" aria-hidden="true" />
                </button>

                <button type="button" className="nav-icon-btn" aria-label="Notifications">
                  <img src="/bell-icon.svg" alt="" aria-hidden="true" />
                </button>

                <Link to="/profile" className="nav-icon-btn nav-icon-btn--profile" aria-label="Profile">
                  <img src="/tester-pfp-icon.svg" alt="" aria-hidden="true" />
                </Link>
              </div>

              <button type="button" className="clearbtn" onClick={toggleDropdown} style={{ '--size': '28px' }} aria-label="Toggle menu">
                <img src="/drop-down-icon.svg" alt="" aria-hidden="true" />
              </button>

              {/*This is the actual menu that appears/disappears
              {isOpen && (
                <ul style={{ position: 'absolute', right: 0, backgroundColor: 'white', border: '1px solid #ccc', listStyle: 'none', padding: '10px' }}>
                  <li><Link to="/settings" onClick={() => setIsOpen(false)}>Settings</Link></li>
                  <li><Link to="/logout" onClick={() => setIsOpen(false)}>Logout</Link></li>
                </ul>
              )}
              DROPDOWN SECTION END */}
            </>
          ) : (
            <>
            <Link to="/authlogin" className="nav-auth-btn nav-auth-btn--login">
              <span>Log In</span>
            </Link>

            <Link to="/authsignup" className="nav-auth-btn nav-auth-btn--signup">
              <span>Sign Up</span>
            </Link>
            </>
          )}
        </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;