import { useRef } from 'react';

interface Props {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onUpload, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  }

  function handleClick() {
    inputRef.current?.click();
  }

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        type="file"
        accept=".json,.csv"
        onChange={handleChange}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <button onClick={handleClick} disabled={disabled}>
        Select Flo Export File
      </button>
      <p className="hint">Supported formats: JSON, CSV</p>
    </div>
  );
}
