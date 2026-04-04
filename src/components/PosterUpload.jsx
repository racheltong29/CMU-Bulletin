// src/components/PosterUpload.jsx
import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import MultiSelectDropdown from './MultiSelectDropdown';

function PosterUpload({ user }) {
  const [title, setTitle] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState([]); // Initialize as array for multi-select
  const [otherLocation, setOtherLocation] = useState('');
  const [category, setCategory] = useState([]); // Initialize as array for multi-select
  const [tags, setTags] = useState('');
  const [repeating, setRepeating] = useState(false);
  const [singleEventDate, setSingleEventDate] = useState('');
  const [nextOccurringDate, setNextOccurringDate] = useState('');
  const [frequency, setFrequency] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const availableCategories = ['career', 'club', 'performance', 'sports', 'wellness']; // Hardcoded sorted
  const availableLocations = [
    'University Center',
    'Hunt Library',
    'Purnell',
    'CFA',
    'Wean',
    'Gates',
    'Tepper',
    'The Cut',
    'Baker-Porter',
    'Posner',
    'Scaife',
    'Online',
    'Off-Campus',
    'Other',
  ];

  const handleDayChange = (e) => {
    const { value, checked } = e.target;
    setDaysOfWeek(prev =>
      checked ? [...prev, value] : prev.filter(day => day !== value)
    );
  };

  const handleCategoryChange = (e) => {
    const { value, checked } = e.target;
    setCategory(prev =>
      checked ? [...prev, value] : prev.filter(c => c !== value)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setError('You must be logged in to upload a poster.');
      return;
    }
    if (category.length === 0) {
      setError('Please select at least one category.');
      return;
    }
    if (location.length === 0) {
      setError('Please select at least one location.');
      return;
    }
    if (location.includes('Other') && !otherLocation.trim()) {
      setError('Please specify the other location.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      let finalLocations = [...location];
      if (location.includes('Other')) {
        finalLocations = finalLocations.filter(loc => loc !== 'Other');
        finalLocations.push(otherLocation.trim());
      }

      const posterData = {
        title,
        organizer,
        description,
        location: finalLocations, // Now an array of selected locations or custom 'Other'
        category, // Now an array
        uploaded_by: auth.currentUser.uid,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
        repeating,
        created_at: Timestamp.now(),
        sort_date: repeating ? nextOccurringDate : singleEventDate,
      };

      if (repeating) {
        posterData.next_occurring_date = nextOccurringDate;
        posterData.frequency = frequency;
        posterData.days_of_week = daysOfWeek;
      } else {
        posterData.single_event_date = singleEventDate;
      }

      await addDoc(collection(db, 'posters'), posterData);

      setSuccess(true);
      setTitle('');
      setOrganizer('');
      setDescription('');
      setLocation('');
      setCategory([]); // Reset to empty array
      setTags('');
      setRepeating(false);
      setSingleEventDate('');
      setNextOccurringDate('');
      setFrequency('');
      setDaysOfWeek([]);
      setOtherLocation('');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Upload New Poster</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Title:</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label>Organizer:</label>
          <input type="text" value={organizer} onChange={(e) => setOrganizer(e.target.value)} required />
        </div>
        <div>
          <label>Description:</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
        </div>
        <div>
          <label>Location:</label>
          <MultiSelectDropdown
            label="Select Location"
            options={availableLocations}
            selectedOptions={location}
            onChange={setLocation}
          />
          {location.includes('Other') && (
            <div>
              <label>Specify Other Location:</label>
              <input type="text" value={otherLocation} onChange={(e) => setOtherLocation(e.target.value)} required={location.includes('Other')} />
            </div>
          )}
        </div>
        <div>
          <label>Categories:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {availableCategories.map(cat => (
              <label key={cat}>
                <input
                  type="checkbox"
                  value={cat}
                  checked={category.includes(cat)}
                  onChange={handleCategoryChange}
                />
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label>Tags (comma-separated):</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div>
          <label>
            <input type="checkbox" checked={repeating} onChange={(e) => setRepeating(e.target.checked)} />
            Repeating Event
          </label>
        </div>

        {!repeating && (
          <div>
            <label>Event Date:</label>
            <input type="date" value={singleEventDate} onChange={(e) => setSingleEventDate(e.target.value)} />
          </div>
        )}

        {repeating && (
          <>
            <div>
              <label>Next Occurring Date:</label>
              <input type="date" value={nextOccurringDate} onChange={(e) => setNextOccurringDate(e.target.value)} />
            </div>
            <div>
              <label>Frequency:</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="">Select Frequency</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Every other week</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label>Days of Week:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      value={day}
                      checked={daysOfWeek.includes(day)}
                      onChange={handleDayChange}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        <button type="submit" disabled={uploading} className="btn">
          {uploading ? 'Uploading...' : 'Upload Poster'}
        </button>
        {error && <p className="form-message error">{error}</p>}
        {success && <p className="form-message success">Poster uploaded successfully!</p>}
      </form>
    </div>
  );
}

export default PosterUpload;
