import React, { useState, useEffect } from 'react';

const MissionCard = ({ mission, onComplete, onAbandon }) => {
  const [timeRemaining, setTimeRemaining] = useState(mission.duration * 60);
  const [progress, _setProgress] = useState(mission.progress || {});

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getProgressPercentage = (criterion, target) => {
    const current = progress[criterion] || 0;
    if (typeof target === 'number') {
      return Math.min((current / target) * 100, 100);
    }
    return current ? 100 : 0;
  };

  return (
    <div className="mission-card">
      <div className="mission-header">
        <h3>{mission.title}</h3>
        <div className="mission-timer">{formatTime(timeRemaining)}</div>
      </div>
      <div className="mission-progress">
        <div className="progress-items">
          {Object.entries(mission.success_criteria).map(([criterion, target]) => {
            const percentage = getProgressPercentage(criterion, target);
            const current = progress[criterion] || 0;
            
            return (
              <div key={criterion} className="progress-item">
                <div className="progress-label">
                  {criterion.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="progress-value">
                  {current}{typeof target === 'number' ? ` / ${target}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mission-actions">
        <button onClick={() => onComplete(mission.id)} className="btn-complete">
          Complete
        </button>
        <button onClick={() => onAbandon(mission.id)} className="btn-abandon">
          Abandon
        </button>
      </div>
    </div>
  );
};

export default MissionCard;

