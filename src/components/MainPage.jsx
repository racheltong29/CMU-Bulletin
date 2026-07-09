import React from "react";
import FeatureHero from "./FeatureHero";
import PosterFilters from "./PosterFilters";
import PosterList from "./PosterList";
import { FEATURE_HERO_ENABLED } from "../config/featureHero";

function MainPage({ user, activeCategory, filterDate, setFilterDate, filterLocations, setFilterLocations, filterTags, setFilterTags, searchQuery, setSearchQuery, availableTags, viewMode, toggleViewMode  }) {

  return (
    <div className="main-page">
      <div className="page-content main-page-content">
        {FEATURE_HERO_ENABLED && <FeatureHero activeCategory={activeCategory} />}

        <PosterFilters
          filterDate={filterDate}
          setFilterDate={setFilterDate}
          filterLocations={filterLocations}
          setFilterLocations={setFilterLocations}
          filterTags={filterTags}
          setFilterTags={setFilterTags}
          availableTags={availableTags}
          toggleViewMode={toggleViewMode}
          viewMode={viewMode}
          activeCategory={activeCategory}
          setSearchQuery={setSearchQuery}
        />

        <div className="poster-list-wrapper">
          <PosterList
            filterDate={filterDate}
            filterLocations={filterLocations}
            filterTags={filterTags}
            searchQuery={searchQuery}
            user={user}
            viewMode={viewMode}
          />
        </div>
      </div>
    </div>
  );
}

export default MainPage;
