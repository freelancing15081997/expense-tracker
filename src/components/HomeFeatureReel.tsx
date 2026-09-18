import React from 'react';

/**
 * Compact looping concept reel — top-right beside name + amount.
 * Pure CSS, no video file. Add → Split → Manage.
 */
export default function HomeFeatureReel() {
  return (
    <aside className="home-feature-reel" aria-label="Add, split, manage">
      <div className="home-feature-reel-stage" aria-hidden>
        <div className="hfr-scene is-add">
          <span className="hfr-chip">Add</span>
          <div className="hfr-card">
            <span className="hfr-rupee">₹</span>
            <span className="hfr-line hfr-line-a" />
            <span className="hfr-line hfr-line-b" />
            <span className="hfr-tick" />
          </div>
        </div>
        <div className="hfr-scene is-split">
          <span className="hfr-chip">Split</span>
          <div className="hfr-split-row">
            <span className="hfr-avatar">A</span>
            <span className="hfr-avatar">B</span>
            <span className="hfr-avatar">C</span>
          </div>
          <div className="hfr-bars">
            <span /><span /><span />
          </div>
        </div>
        <div className="hfr-scene is-manage">
          <span className="hfr-chip">Manage</span>
          <div className="hfr-chart">
            <span className="hfr-bar b1" />
            <span className="hfr-bar b2" />
            <span className="hfr-bar b3" />
            <span className="hfr-bar b4" />
          </div>
        </div>
      </div>
    </aside>
  );
}
