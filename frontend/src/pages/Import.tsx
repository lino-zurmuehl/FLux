import { useState } from 'react';
import { FileUpload } from '../components/FileUpload';

export function Import() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleFileUpload(file: File) {
    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/v1/import/flo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(`Imported ${data.cycles_imported || 0} cycles`);
    } catch (error) {
      setResult('Import failed. Please check your file format.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="import-page">
      <h1>Import Data</h1>
      <p>Import your data from the Flo app export.</p>

      <div className="privacy-info">
        <h3>Privacy Notice</h3>
        <p>
          Your data is processed locally and encrypted before storage.
          The raw export file is not stored - only the extracted cycle dates.
        </p>
      </div>

      <FileUpload onUpload={handleFileUpload} disabled={importing} />

      {importing && <p>Importing...</p>}
      {result && <p className="result">{result}</p>}
    </div>
  );
}
