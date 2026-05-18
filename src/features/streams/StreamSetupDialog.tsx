import { useEffect, useState } from 'react';
import { FolderOpen, Plus, Printer, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { AutoPrintItem, FileNamingExtension, FileNamingField, FileNamingFieldType, FileNamingSeparator, ImageStream } from '../../data/models';
import { isTauriRuntime } from '../../runtime/runtime';
import { confirmDestructive } from '../../utils/confirm';
import { Toggle } from './StreamCard';
import {
  codeFromName,
  DEFAULT_NAMING_FIELDS,
  DEFAULT_PRINT_ITEMS,
  makeField,
  NAMING_FIELD_OPTIONS,
  previewFilename,
} from './streamUiHelpers';

export function StreamSetupDialog({ open, stream, onClose }: { open: boolean; stream?: ImageStream | null; onClose: () => void }) {
  const { createImageStream, updateImageStream, deleteImageStream } = useApp();
  const [name, setName] = useState(stream?.name ?? '');
  const [watchPath, setWatchPath] = useState(stream?.watchPath ?? '');
  const [processingPreset, setProcessingPreset] = useState(stream?.processingPreset ?? 'Default - Background removal + Enhance');
  const [printerName, setPrinterName] = useState(stream?.printerName ?? 'Epson SureColor P900');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(stream?.autoPrintEnabled ?? true);
  const [autoPrintItems, setAutoPrintItems] = useState<AutoPrintItem[]>(stream?.autoPrintItems?.length ? stream.autoPrintItems : DEFAULT_PRINT_ITEMS);
  const [enabled, setEnabled] = useState(stream?.enabled ?? true);
  const [autoEnhanceEnabled, setAutoEnhanceEnabled] = useState(stream?.autoEnhanceEnabled ?? false);
  const [fileRenamingEnabled, setFileRenamingEnabled] = useState(stream?.fileRenamingEnabled ?? false);
  const [fileNamingFields, setFileNamingFields] = useState<FileNamingField[]>(stream?.fileNamingFields?.length ? stream.fileNamingFields : DEFAULT_NAMING_FIELDS);
  const [fileNamingSeparator, setFileNamingSeparator] = useState<FileNamingSeparator>(stream?.fileNamingSeparator ?? '_');
  const [fileNamingExtension, setFileNamingExtension] = useState<FileNamingExtension>(stream?.fileNamingExtension ?? 'JPG');
  const [error, setError] = useState('');
  const isDesktop = isTauriRuntime();
  const isEditing = Boolean(stream);
  const code = stream?.code ?? codeFromName(name);

  useEffect(() => {
    if (!open) return;
    setName(stream?.name ?? '');
    setWatchPath(stream?.watchPath ?? '');
    setProcessingPreset(stream?.processingPreset ?? 'Default - Background removal + Enhance');
    setPrinterName(stream?.printerName ?? 'Epson SureColor P900');
    setAutoPrintEnabled(stream?.autoPrintEnabled ?? true);
    setAutoPrintItems(stream?.autoPrintItems?.length ? stream.autoPrintItems : DEFAULT_PRINT_ITEMS);
    setEnabled(stream?.enabled ?? true);
    setAutoEnhanceEnabled(stream?.autoEnhanceEnabled ?? false);
    setFileRenamingEnabled(stream?.fileRenamingEnabled ?? false);
    setFileNamingFields(stream?.fileNamingFields?.length ? stream.fileNamingFields : DEFAULT_NAMING_FIELDS);
    setFileNamingSeparator(stream?.fileNamingSeparator ?? '_');
    setFileNamingExtension(stream?.fileNamingExtension ?? 'JPG');
    setError('');
  }, [open, stream]);

  if (!open) return null;

  const canCreate = name.trim().length > 0 && watchPath.trim().length > 0;

  const browse = async () => {
    if (!isDesktop) return;
    const dialog = await import('@tauri-apps/plugin-dialog');
    const selected = await dialog.open({ directory: true, multiple: false });
    if (typeof selected === 'string') setWatchPath(selected);
  };

  const save = async () => {
    if (!canCreate) {
      setError('Fill name and a folder path.');
      return;
    }
    try {
      if (stream) {
        await updateImageStream(stream.id, {
          name, code, watchPath, enabled, processingPreset, printerName,
          autoPrintEnabled, autoPrintItems, autoEnhanceEnabled, fileRenamingEnabled,
          fileNamingFields, fileNamingSeparator, fileNamingExtension,
        });
      } else {
        await createImageStream({
          name, code, watchPath, enabled, processingPreset, printerName,
          autoPrintEnabled, autoPrintItems, autoEnhanceEnabled, fileRenamingEnabled,
          fileNamingFields, fileNamingSeparator, fileNamingExtension,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save stream.');
      return;
    }
    setName('');
    setWatchPath('');
    setProcessingPreset('Default - Background removal + Enhance');
    setPrinterName('Epson SureColor P900');
    setAutoPrintEnabled(true);
    setAutoPrintItems(DEFAULT_PRINT_ITEMS);
    setEnabled(true);
    setAutoEnhanceEnabled(false);
    setFileRenamingEnabled(false);
    setFileNamingFields(DEFAULT_NAMING_FIELDS);
    setFileNamingSeparator('_');
    setFileNamingExtension('JPG');
    setError('');
    onClose();
  };

  const updateNamingField = (id: string, changes: Partial<FileNamingField>) => {
    setFileNamingFields(fields => fields.map(field => (
      field.id === id
        ? { ...field, ...changes, customText: changes.type && changes.type !== 'custom' ? undefined : changes.customText ?? field.customText }
        : field
    )));
  };

  const removeNamingField = (id: string) => {
    setFileNamingFields(fields => fields.length <= 1 ? fields : fields.filter(field => field.id !== id));
  };

  const confirmDelete = async () => {
    if (!stream) return;
    const confirmed = await confirmDestructive(
      'This will permanently remove this Photo Op from PhotoFlow. Photo files and already-imported sessions will NOT be deleted.',
      `Delete Photo Op: ${stream.name}`,
    );
    if (!confirmed) return;
    await deleteImageStream(stream.id);
    onClose();
  };

  return (
    <div className="stream-modal-backdrop">
      <div className="stream-modal">
        <div className="stream-modal-head">
          <div className="stream-icon" style={{ color: 'var(--accent)' }}><Plus size={15} /></div>
          <div className="col grow" style={{ lineHeight: 1.15 }}>
            <strong>{isEditing ? 'Photo Op Settings' : 'Add New Photo Op'}</strong>
            <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{isEditing ? 'Edit stream settings, watcher folder and delete options.' : 'Define a capture location and the folder it should watch.'}</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="stream-modal-body">
          <div className="stream-form-grid stream-form-grid-single">
            <label className="stream-field">
              <span>NAME <small>visible everywhere</small></span>
              <input value={name} onChange={event => setName(event.target.value)} placeholder="Lion Cubs" />
            </label>
          </div>

          <label className="stream-field">
            <span>WATCHER FOLDER <small>auto-monitored</small></span>
            <div className="stream-folder-input">
              <FolderOpen size={13} />
              <input value={watchPath} onChange={event => setWatchPath(event.target.value)} placeholder={isDesktop ? 'C:\\PhotoFlow Intake\\Lion Cubs' : 'Desktop-only folder path'} />
              <button className="btn" disabled={!isDesktop} onClick={() => void browse()}>Browse...</button>
            </div>
          </label>

          <div className="file-naming-panel">
            <div className="file-naming-head">
              <div>
                <span className="uppercase">Auto Enhance</span>
                <div className="mono">Automatically improve white balance, exposure and saturation on import</div>
              </div>
              <Toggle on={autoEnhanceEnabled} onChange={() => setAutoEnhanceEnabled(value => !value)} />
            </div>
            {!autoEnhanceEnabled && (
              <div className="file-renaming-off mono">Enhancement disabled — photos import as-is.</div>
            )}
            {autoEnhanceEnabled && (
              <div className="file-renaming-off mono">JPEG and PNG files will be auto-enhanced after import. Original is preserved.</div>
            )}
          </div>

          <div className="file-naming-panel">
            <div className="file-naming-head">
              <div>
                <span className="uppercase">File Renaming</span>
                <div className="mono">{fileRenamingEnabled ? 'rename on import' : 'keep existing filename on import'}</div>
              </div>
              <Toggle on={fileRenamingEnabled} onChange={() => setFileRenamingEnabled(value => !value)} />
            </div>
            {fileRenamingEnabled ? (
              <>
                <div className="file-naming-section-title">Naming Fields</div>
                <div className="naming-fields">
                  {fileNamingFields.map((field, index) => (
                    <div className="naming-field-row" key={field.id}>
                      <span className="mono">FIELD {index + 1}</span>
                      <select
                        value={field.type}
                        onChange={event => updateNamingField(field.id, { type: event.target.value as FileNamingFieldType })}
                      >
                        {NAMING_FIELD_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {field.type === 'custom' && (
                        <input
                          value={field.customText ?? ''}
                          onChange={event => updateNamingField(field.id, { customText: event.target.value })}
                          placeholder="Enter text..."
                        />
                      )}
                      <button className="icon-btn" title="Remove field" onClick={() => removeNamingField(field.id)} disabled={fileNamingFields.length <= 1}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn ghost file-add-field" onClick={() => setFileNamingFields(fields => [...fields, makeField('barcode')])}>
                  <Plus size={12} /> Add Field
                </button>
                <div className="file-option-row">
                  <span>Separator</span>
                  <div className="segmented-mini">
                    {(['-', '.', '_'] as FileNamingSeparator[]).map(separator => (
                      <button
                        key={separator}
                        className={fileNamingSeparator === separator ? 'active' : ''}
                        onClick={() => setFileNamingSeparator(separator)}
                      >
                        {separator}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="file-option-row">
                  <span>Extension</span>
                  <div className="segmented-mini wide">
                    {(['JPG', 'DNG', 'RAW'] as FileNamingExtension[]).map(extension => (
                      <button
                        key={extension}
                        className={fileNamingExtension === extension ? 'active' : ''}
                        onClick={() => setFileNamingExtension(extension)}
                      >
                        {extension}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="file-preview">
                  <span>Preview</span>
                  <strong className="mono">{previewFilename(fileNamingFields, fileNamingSeparator, fileNamingExtension, name, code)}</strong>
                </div>
              </>
            ) : (
              <div className="file-renaming-off mono">Imported photos keep the exact detected filename.</div>
            )}
          </div>

          <label className="stream-field">
            <span>PROCESSING PRESET</span>
            <select value={processingPreset} onChange={event => setProcessingPreset(event.target.value)}>
              <option>Default - Background removal + Enhance</option>
              <option>Import only - no processing</option>
              <option>Background removal only</option>
              <option>Enhance only</option>
            </select>
          </label>

          <div className="stream-form-grid">
            <label className="stream-field stream-field-wide">
              <span>PRINTER</span>
              <div className="stream-folder-input">
                <Printer size={13} />
                <select value={printerName} onChange={event => setPrinterName(event.target.value)}>
                  <option>Epson SureColor P900</option>
                  <option>Canon imagePROGRAF</option>
                  <option>DNP DS820A</option>
                  <option>No printer</option>
                </select>
              </div>
            </label>
            <div className="stream-create-toggles">
              <div className="uppercase">On Creation</div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Auto-print</span>
                <Toggle on={autoPrintEnabled} onChange={() => setAutoPrintEnabled(value => !value)} />
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Enable stream</span>
                <Toggle on={enabled} onChange={() => setEnabled(value => !value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="stream-modal-foot">
          <span className="mono" style={{ color: error ? 'var(--warn)' : 'var(--ink-4)', fontSize: 10.5 }}>{error || 'Fill name and a folder path.'}</span>
          {isEditing && (
            <button className="btn ghost" style={{ color: 'var(--danger)' }} onClick={() => void confirmDelete()}>
              <Trash2 size={13} /> Delete Photo Op
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canCreate} onClick={() => void save()}>
            <Plus size={13} /> {isEditing ? 'Save Photo Op' : 'Create Photo Op'}
          </button>
        </div>
      </div>
    </div>
  );
}
