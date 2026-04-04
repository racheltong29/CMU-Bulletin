// src/components/Modal.jsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import HeartIcon from './HeartIcon';
import { posterImgSrc } from '../posterImage';

function Modal({ poster, onClose, user, likedPosters, handleLikeToggle, uploaderName }) {
  if (!poster) return null;

  const googleCalUrl = poster.googleCalUrl;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}> {/* Prevent clicks inside from closing modal */}
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        {user && (
          <HeartIcon
            filled={likedPosters.includes(poster.id)}
            onClick={() => {
              console.log('Heart icon clicked for poster:', poster.id);
              handleLikeToggle(poster.id);
            }}
            style={{
              position: 'absolute',
              top: '20px',
              right: '100px',
              width: '30px',
              height: '30px',
              zIndex: 100,
            }}
          />
        )}
        <div className="modal-body">
          <div className="modal-image-container">
            <img src={posterImgSrc(poster)} alt={poster.title} />
          </div>
          <div className="modal-details-container">
            <h2>{poster.title}</h2>
            <p><strong>{poster.organizer ? 'Organizer:' : 'Uploaded by:'}</strong> {poster.organizer || uploaderName || 'Unknown'}</p>
            <p>{poster.description}</p>
            {!poster.repeating && poster.single_event_date && (
              <p><strong>Date:</strong> {poster.single_event_date}</p>
            )}

            <div>
              <div className="modal-icon">
                <img src='\location-icon.svg'></img>
                <p><strong>Location:</strong> {Array.isArray(poster.location) ? poster.location.join(', ') : poster.location}</p>
              </div>

              

            </div>

            <div className="align-icon">
              
              <img src='\location-icon.svg'></img>
              <span><strong>Location:</strong> {Array.isArray(poster.location) ? poster.location.join(', ') : poster.location}</span>

            </div>

            
            
            <p><strong>Category:</strong> {Array.isArray(poster.category) ? poster.category.join(', ') : poster.category}</p>
            {poster.tags && poster.tags.length > 0 && (
              <p><strong>Tags:</strong> {poster.tags.join(', ')}</p>
            )}
            {poster.repeating && (
              <>
                <p><strong>Next Occurring:</strong> {poster.next_occurring_date}</p>
                <p><strong>Frequency:</strong> {poster.frequency}</p>
                <p><strong>Days:</strong> {poster.days_of_week.join(', ')}</p>
              </>
            )}

          {googleCalUrl && (
              <div className="calendar-export-section" style={{ marginTop: '20px', textAlign: 'center' }}>
                  <h4 style={{ marginBottom: '10px', fontSize: '1rem', fontWeight: 'bold' }}>Add to Calendar</h4>
                  
                  {/* QR Code */}
                  <QRCodeSVG 
                      value={googleCalUrl}
                      size={100}
                      level="L"
                  />

                  {/* Direct Clickable Link */}
                  <p style={{ marginTop: '10px' }}>
                      <a 
                          href={googleCalUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="calendar-link"
                      >
                          Click to Add to Google Calendar
                      </a>
                  </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Modal;