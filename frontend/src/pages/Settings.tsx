import { useState } from 'react';

export function Settings() {
  const [exportFormat, setExportFormat] = useState('json');

  async function handleExportData() {
    // TODO: Implement data export
    alert('Data export coming soon');
  }

  async function handleDeleteData() {
    if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
      // TODO: Implement data deletion
      alert('Data deletion coming soon');
    }
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <section>
        <h2>Data Privacy</h2>
        <p>Your data is encrypted with a key derived from your password.</p>
        <p>We cannot access or read your cycle data.</p>
      </section>

      <section>
        <h2>Export Your Data</h2>
        <p>Download all your data in a portable format.</p>
        <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
        </select>
        <button onClick={handleExportData}>Export</button>
      </section>

      <section>
        <h2>Delete All Data</h2>
        <p>Permanently delete all your stored data.</p>
        <button className="danger" onClick={handleDeleteData}>
          Delete All Data
        </button>
      </section>
    </div>
  );
}
