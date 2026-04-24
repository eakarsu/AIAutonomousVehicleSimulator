import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createService, favorites, auditLogs } from '../services/api';
import { toast } from 'react-toastify';
import { getFormFields, getTableColumns } from '../components/FeatureConfig';

function FeaturePage({ feature, onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  // New state for enhanced features
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(parseInt(localStorage.getItem('pageSize') || '10'));
  const [totalItems, setTotalItems] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [compareItems, setCompareItems] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [userFavorites, setUserFavorites] = useState(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);

  const navigate = useNavigate();
  const service = useMemo(() => createService(feature.endpoint), [feature.endpoint]);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const loadItems = useCallback(async () => {
    try {
      const params = { page: currentPage, limit: pageSize, sortBy, sortOrder };
      if (searchTerm) params.search = searchTerm;
      const res = await service.getAll(params);
      if (res.data.data) {
        setItems(res.data.data);
        setTotalItems(res.data.total);
      } else {
        setItems(res.data);
        setTotalItems(res.data.length);
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [service, currentPage, pageSize, sortBy, sortOrder, searchTerm]);

  const loadFavorites = useCallback(async () => {
    try {
      const res = await favorites.getAll(feature.endpoint);
      const favIds = new Set(res.data.filter(f => f.entityType === feature.endpoint).map(f => f.entityId));
      setUserFavorites(favIds);
    } catch (err) { /* ignore */ }
  }, [feature.endpoint]);

  useEffect(() => {
    setLoading(true);
    setSelectedItem(null);
    setShowForm(false);
    setAiResult(null);
    setSearchTerm('');
    setCurrentPage(1);
    setSortBy('id');
    setSortOrder('ASC');
    setSelectedIds(new Set());
    setCompareItems([]);
    loadItems();
    loadFavorites();
  }, [feature.endpoint]);

  useEffect(() => {
    loadItems();
  }, [currentPage, sortBy, sortOrder]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      loadItems();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); handleNew(); }
      if (e.key === '/') { e.preventDefault(); document.querySelector('.search-input')?.focus(); }
      if (e.key === 'Escape') {
        setSelectedItem(null);
        setShowForm(false);
        setShowAiGen(false);
        setShowCompare(false);
        setShowImport(false);
        setShowExportMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const logAction = async (action, entityName) => {
    try {
      await auditLogs.create({ action, entityType: feature.endpoint, entityName });
    } catch (err) { /* ignore */ }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await service.delete(id);
      toast.success('Deleted successfully');
      logAction('DELETE', items.find(i => i.id === id)?.name);
      setSelectedItem(null);
      loadItems();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected items?`)) return;
    try {
      await service.bulkDelete([...selectedIds]);
      toast.success(`${selectedIds.size} items deleted`);
      logAction('DELETE', `${selectedIds.size} items (bulk)`);
      setSelectedIds(new Set());
      setSelectAll(false);
      loadItems();
    } catch (err) {
      toast.error('Bulk delete failed');
    }
  };

  const handleDuplicate = async (item) => {
    try {
      await service.duplicate(item.id);
      toast.success('Item duplicated');
      logAction('CREATE', `${item.name} (Copy)`);
      loadItems();
    } catch (err) {
      toast.error('Duplicate failed');
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setFormData({ ...item });
    setSelectedItem(null);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditItem(null);
    const fields = getFormFields(feature.key);
    const initial = {};
    fields.forEach(f => { initial[f.field] = f.default || ''; });
    setFormData(initial);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...formData };
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;
      if (editItem) {
        await service.update(editItem.id, data);
        toast.success('Updated successfully');
        logAction('UPDATE', formData.name);
      } else {
        await service.create(data);
        toast.success('Created successfully');
        logAction('CREATE', formData.name);
      }
      setShowForm(false);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const res = await service.export(format);
      const blob = format === 'csv' ? res.data : new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${feature.endpoint}_export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
      logAction('EXPORT', feature.title);
      setShowExportMenu(false);
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importText);
      const items = Array.isArray(data) ? data : [data];
      const res = await service.import(items);
      toast.success(res.data.message);
      logAction('IMPORT', `${res.data.count} items`);
      setShowImport(false);
      setImportText('');
      loadItems();
    } catch (err) {
      if (err instanceof SyntaxError) {
        toast.error('Invalid JSON format');
      } else {
        toast.error('Import failed');
      }
    }
  };

  const toggleFavorite = async (item) => {
    try {
      const res = await favorites.toggle({
        entityType: feature.endpoint,
        entityId: item.id,
        entityName: item.name
      });
      const newFavs = new Set(userFavorites);
      if (res.data.favorited) {
        newFavs.add(item.id);
        toast.success('Added to favorites');
      } else {
        newFavs.delete(item.id);
        toast.success('Removed from favorites');
      }
      setUserFavorites(newFavs);
    } catch (err) {
      toast.error('Failed to update favorite');
    }
  };

  const toggleSelectItem = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    setSelectAll(newSelected.size === items.length);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleCompareItem = (item) => {
    if (compareItems.find(c => c.id === item.id)) {
      setCompareItems(compareItems.filter(c => c.id !== item.id));
    } else if (compareItems.length < 2) {
      setCompareItems([...compareItems, item]);
    } else {
      toast.info('Can only compare 2 items at a time');
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setCurrentPage(1);
  };

  const handleAiAnalyze = async (item) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await service.aiAnalyze(item.id);
      setAiResult(res.data.aiAnalysis);
    } catch (err) {
      toast.error('AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await service.aiGenerate(aiPrompt);
      setAiResult(res.data.aiResult);
    } catch (err) {
      toast.error('AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const columns = getTableColumns(feature.key);
  const formFields = getFormFields(feature.key);
  const totalPages = Math.ceil(totalItems / pageSize);

  const renderAiContent = (content) => {
    if (!content) return null;
    const sections = content.split(/(?=\d+[\.\)]\s|#{1,3}\s|\*\*[^*]+\*\*:)/g).filter(Boolean);
    if (sections.length <= 1) {
      return content.split('\n').map((line, i) => {
        line = line.trim();
        if (!line) return null;
        if (line.startsWith('**') && line.endsWith('**')) return <h4 key={i} className="ai-section-title">{line.replace(/\*\*/g, '')}</h4>;
        if (line.startsWith('#')) return <h4 key={i} className="ai-section-title">{line.replace(/^#+\s*/, '')}</h4>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i}>{formatBold(line.substring(2))}</li>;
        return <p key={i} style={{ marginBottom: 6 }}>{formatBold(line)}</p>;
      });
    }
    return sections.map((section, i) => {
      const lines = section.trim().split('\n');
      const title = lines[0]?.replace(/^[\d.)\s#*]+/, '').replace(/\*\*/g, '').trim();
      const body = lines.slice(1).join('\n').trim();
      return (
        <div key={i} className="ai-section">
          {title && <div className="ai-section-title">{title}</div>}
          <div className="ai-section-content">
            {body.split('\n').map((line, j) => {
              line = line.trim();
              if (!line) return null;
              if (line.startsWith('- ') || line.startsWith('* ')) return <li key={j}>{formatBold(line.substring(2))}</li>;
              return <p key={j} style={{ marginBottom: 4 }}>{formatBold(line)}</p>;
            })}
          </div>
        </div>
      );
    });
  };

  const formatBold = (text) => {
    if (!text) return text;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: '#e2e8f0' }}>{part.slice(2, -2)}</strong>;
      return part;
    });
  };

  const getStatusClass = (status) => {
    if (!status) return '';
    const s = status.toLowerCase().replace(/\s+/g, '-');
    return `status-${s}`;
  };

  const renderCellValue = (item, col) => {
    const val = item[col.field];
    if (val === null || val === undefined) return '-';
    if (col.field === 'status' || col.field === 'operationalStatus' || col.field === 'complianceStatus') {
      return <span className={`status-badge ${getStatusClass(String(val))}`}>{String(val)}</span>;
    }
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'number') {
      if (col.field.includes('accuracy') || col.field.includes('Rate') || col.field.includes('precision') || col.field.includes('recall') || col.field.includes('Score') || col.field.includes('score') || col.field.includes('battery') || col.field.includes('confidence')) {
        return `${val}%`;
      }
      return val.toLocaleString();
    }
    return String(val);
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand" onClick={() => navigate('/dashboard')}>
          <span>🚗</span>
          <h2>AV Simulator</h2>
        </div>
        <div className="navbar-right">
          <span className="navbar-user">{user.name || 'User'}</span>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </nav>
      <div className="feature-page">
        <div className="feature-header">
          <div className="feature-header-left">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>
            <h1>{feature.icon} {feature.title}</h1>
            <span className="record-count">{totalItems} records</span>
          </div>
          <div className="feature-header-right">
            {compareItems.length === 2 && (
              <button className="compare-btn" onClick={() => setShowCompare(true)}>Compare ({compareItems.length})</button>
            )}
            {selectedIds.size > 0 && (
              <button className="bulk-delete-btn" onClick={handleBulkDelete}>
                Delete ({selectedIds.size})
              </button>
            )}
            <div className="export-dropdown">
              <button className="export-btn" onClick={() => setShowExportMenu(!showExportMenu)}>Export</button>
              {showExportMenu && (
                <div className="export-menu">
                  <button onClick={() => handleExport('json')}>Export JSON</button>
                  <button onClick={() => handleExport('csv')}>Export CSV</button>
                </div>
              )}
            </div>
            <button className="import-btn" onClick={() => setShowImport(true)}>Import</button>
            <button className="ai-gen-btn" onClick={() => { setShowAiGen(true); setAiResult(null); setAiPrompt(''); }}>
              AI Generate
            </button>
            <button className="add-btn" onClick={handleNew}>+ New Item</button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder={`Search ${feature.title.toLowerCase()}... (press / to focus)`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="search-clear" onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner"></div></div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">{feature.icon}</span>
            <h3>No {feature.title} Found</h3>
            <p>{searchTerm ? `No results for "${searchTerm}"` : 'Click "New Item" to create your first entry'}</p>
          </div>
        ) : (
          <>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="checkbox-col">
                      <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                    </th>
                    <th className="favorite-col"></th>
                    <th onClick={() => handleSort('id')} className="sortable-th">
                      # {sortBy === 'id' && <span className="sort-arrow">{sortOrder === 'ASC' ? '▲' : '▼'}</span>}
                    </th>
                    {columns.map(col => (
                      <th key={col.field} onClick={() => handleSort(col.field)} className="sortable-th">
                        {col.label} {sortBy === col.field && <span className="sort-arrow">{sortOrder === 'ASC' ? '▲' : '▼'}</span>}
                      </th>
                    ))}
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className={selectedIds.has(item.id) ? 'row-selected' : ''}>
                      <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelectItem(item.id)} />
                      </td>
                      <td className="favorite-col" onClick={(e) => { e.stopPropagation(); toggleFavorite(item); }}>
                        <span className={`favorite-star ${userFavorites.has(item.id) ? 'favorited' : ''}`}>
                          {userFavorites.has(item.id) ? '★' : '☆'}
                        </span>
                      </td>
                      <td onClick={() => { setSelectedItem(item); setAiResult(null); }}>
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      {columns.map(col => (
                        <td key={col.field} onClick={() => { setSelectedItem(item); setAiResult(null); }}>
                          {renderCellValue(item, col)}
                        </td>
                      ))}
                      <td className="actions-col" onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="row-action-btn" onClick={() => handleEdit(item)} title="Edit">✏️</button>
                          <button className="row-action-btn" onClick={() => handleDuplicate(item)} title="Duplicate">📋</button>
                          <button className="row-action-btn" onClick={() => toggleCompareItem(item)} title="Compare"
                            style={compareItems.find(c => c.id === item.id) ? {background: 'rgba(59,130,246,0.2)'} : {}}>
                            ⚖️
                          </button>
                          <button className="row-action-btn delete" onClick={() => handleDelete(item.id)} title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
                <button className="page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>Prev</button>
                <div className="page-numbers">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button key={pageNum} className={`page-num ${pageNum === currentPage ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}>
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>Next</button>
                <button className="page-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
                <span className="page-info">{totalItems} total</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h2>{selectedItem.name}</h2>
              <button className="modal-close" onClick={() => setSelectedItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                {Object.entries(selectedItem).filter(([key]) => !['id','createdAt','updatedAt'].includes(key)).map(([key, val]) => (
                  <div key={key} className={`detail-item ${(key === 'description' || key === 'recommendations' || typeof val === 'object') ? 'full-width' : ''}`}>
                    <div className="detail-label">{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</div>
                    <div className="detail-value">
                      {val === null || val === undefined ? '-' :
                       typeof val === 'boolean' ? (val ? 'Yes' : 'No') :
                       typeof val === 'object' ? JSON.stringify(val, null, 2) :
                       String(val)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="detail-timestamps">
                <span>Created: {new Date(selectedItem.createdAt).toLocaleString()}</span>
                <span>Updated: {new Date(selectedItem.updatedAt).toLocaleString()}</span>
              </div>

              {aiLoading && (
                <div className="ai-output">
                  <div className="ai-output-header">AI Analysis</div>
                  <div className="ai-loading"><div className="spinner"></div><span>Analyzing with AI...</span></div>
                </div>
              )}
              {aiResult && (
                <div className="ai-output">
                  <div className="ai-output-header">AI Analysis {aiResult.model && `(${aiResult.model})`}</div>
                  <div className="ai-output-body">
                    {aiResult.success ? renderAiContent(aiResult.content) : (
                      <div className="ai-section">
                        <div className="ai-section-content" style={{ color: '#fca5a5' }}>
                          {aiResult.error || 'AI analysis unavailable. Please configure your OpenRouter API key in .env'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-ai" onClick={() => handleAiAnalyze(selectedItem)} disabled={aiLoading}>
                {aiLoading ? 'Analyzing...' : 'AI Analyze'}
              </button>
              <button className="btn-edit" onClick={() => handleDuplicate(selectedItem)}>Duplicate</button>
              <button className="btn-edit" onClick={() => handleEdit(selectedItem)}>Edit</button>
              <button className="btn-delete" onClick={() => handleDelete(selectedItem.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay form-modal" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editItem ? 'Edit' : 'New'} {feature.title.replace(/s$/, '')}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSave}>
                <div className="form-grid">
                  {formFields.map(f => (
                    <div key={f.field} className={`form-group ${f.fullWidth ? 'full-width' : ''}`}>
                      <label>{f.label}</label>
                      {f.type === 'textarea' ? (
                        <textarea value={formData[f.field] || ''} onChange={(e) => setFormData({ ...formData, [f.field]: e.target.value })} required={f.required} />
                      ) : f.type === 'select' ? (
                        <select value={formData[f.field] || ''} onChange={(e) => setFormData({ ...formData, [f.field]: e.target.value })} required={f.required}>
                          <option value="">Select...</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={f.type || 'text'} value={formData[f.field] || ''}
                          onChange={(e) => setFormData({ ...formData, [f.field]: f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })}
                          required={f.required} step={f.type === 'number' ? 'any' : undefined}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Saving...' : (editItem ? 'Update' : 'Create')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      {showAiGen && (
        <div className="modal-overlay ai-gen-modal" onClick={(e) => { if (e.target === e.currentTarget) setShowAiGen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h2>AI Generate {feature.title.replace(/s$/, '')}</h2>
              <button className="modal-close" onClick={() => setShowAiGen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <textarea className="ai-gen-input" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={`Describe what kind of ${feature.title.toLowerCase()} you want to generate...`} />
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAiGen(false)}>Close</button>
                <button className="btn-ai" onClick={handleAiGenerate} disabled={aiLoading}>
                  {aiLoading ? 'Generating...' : 'Generate with AI'}
                </button>
              </div>
              {aiLoading && (
                <div className="ai-output" style={{ marginTop: 20 }}>
                  <div className="ai-output-header">AI Generation</div>
                  <div className="ai-loading"><div className="spinner"></div><span>Generating with AI...</span></div>
                </div>
              )}
              {aiResult && (
                <div className="ai-output" style={{ marginTop: 20 }}>
                  <div className="ai-output-header">AI Generated Content {aiResult.model && `(${aiResult.model})`}</div>
                  <div className="ai-output-body">
                    {aiResult.success ? renderAiContent(aiResult.content) : (
                      <div className="ai-section">
                        <div className="ai-section-content" style={{ color: '#fca5a5' }}>
                          {aiResult.error || 'AI generation unavailable. Please configure your OpenRouter API key in .env'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowImport(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h2>Import {feature.title}</h2>
              <button className="modal-close" onClick={() => setShowImport(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{marginBottom: 12, color: '#94a3b8'}}>Paste JSON data below. Can be an array of objects or a single object.</p>
              <textarea className="ai-gen-input" value={importText} onChange={(e) => setImportText(e.target.value)}
                placeholder='[{"name": "Example", "status": "active", ...}]' style={{minHeight: 200}} />
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowImport(false)}>Cancel</button>
                <button className="btn-save" onClick={handleImport} disabled={!importText.trim()}>Import Data</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompare && compareItems.length === 2 && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCompare(false); }}>
          <div className="modal" style={{maxWidth: 1000}}>
            <div className="modal-header">
              <h2>Compare</h2>
              <button className="modal-close" onClick={() => { setShowCompare(false); setCompareItems([]); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="compare-grid">
                <div className="compare-header">
                  <div className="compare-label">Field</div>
                  <div className="compare-val">{compareItems[0].name}</div>
                  <div className="compare-val">{compareItems[1].name}</div>
                </div>
                {Object.keys(compareItems[0]).filter(k => !['id','createdAt','updatedAt'].includes(k)).map(key => {
                  const v1 = compareItems[0][key];
                  const v2 = compareItems[1][key];
                  const isDiff = JSON.stringify(v1) !== JSON.stringify(v2);
                  return (
                    <div key={key} className={`compare-row ${isDiff ? 'diff' : ''}`}>
                      <div className="compare-label">{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</div>
                      <div className="compare-val">{v1 === null || v1 === undefined ? '-' : typeof v1 === 'object' ? JSON.stringify(v1) : String(v1)}</div>
                      <div className="compare-val">{v2 === null || v2 === undefined ? '-' : typeof v2 === 'object' ? JSON.stringify(v2) : String(v2)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setShowCompare(false); setCompareItems([]); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FeaturePage;
