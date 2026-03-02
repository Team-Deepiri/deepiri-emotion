/**
 * Helox fine-tuning — start a training run from the IDE.
 */

import React, { useState } from 'react';
import { startFineTuning } from '../../services/finetuningService';
import './FineTuningPanel.css';

export default function FineTuningPanel({ projectRoot }) {
  const [datasetPath, setDatasetPath] = useState(projectRoot || '');
  const [baseModel, setBaseModel] = useState('gpt-2');
  const [outputName, setOutputName] = useState('my-model');
  const [epochs, setEpochs] = useState(3);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleStart = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await startFineTuning({
        datasetPath: datasetPath.trim() || projectRoot,
        baseModel: baseModel.trim(),
        outputName: outputName.trim(),
        epochs
      });
      setMessage(result?.ok ? `Started: ${result.message || 'Run queued'}` : result?.message || 'Done');
    } catch (e) {
      setMessage(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finetuning-panel">
      <h2>Helox fine-tuning</h2>
      <p className="finetuning-desc">Train or adapt a model from the IDE. Dataset path, base model, and output name.</p>
      <div className="finetuning-form">
        <label>
          <span>Dataset path</span>
          <input
            type="text"
            value={datasetPath}
            onChange={(e) => setDatasetPath(e.target.value)}
            placeholder={projectRoot || '/path/to/dataset'}
          />
        </label>
        <label>
          <span>Base model</span>
          <input
            type="text"
            value={baseModel}
            onChange={(e) => setBaseModel(e.target.value)}
            placeholder="gpt-2"
          />
        </label>
        <label>
          <span>Output name</span>
          <input
            type="text"
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            placeholder="my-model"
          />
        </label>
        <label>
          <span>Epochs</span>
          <input
            type="number"
            min={1}
            max={20}
            value={epochs}
            onChange={(e) => setEpochs(Number(e.target.value))}
          />
        </label>
        <div className="finetuning-actions">
          <button type="button" className="finetuning-btn primary" onClick={handleStart} disabled={loading}>
            {loading ? 'Starting…' : 'Start fine-tuning'}
          </button>
        </div>
      </div>
      {message && <p className="finetuning-message">{message}</p>}
    </div>
  );
}
