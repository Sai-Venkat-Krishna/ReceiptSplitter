import React, { useState } from 'react';
import { usePeople } from '../context/PeopleContext';
import ConfirmModal from './ConfirmModal';
import './PeopleManager.css';

const COLOR_OPTIONS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981',
    '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
];

const Avatar = ({ name, color, size = 32 }) => (
    <span
        className="person-avatar"
        style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
    >
        {(name || '?').charAt(0).toUpperCase()}
    </span>
);

const PeopleManager = () => {
    const { people, addPerson, updatePerson, deletePerson } = usePeople();
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await addPerson(newName.trim(), newColor);
        setNewName('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleAdd();
    };

    const startEdit = (person) => {
        setEditingId(person._id);
        setEditName(person.name);
        setEditColor(person.color);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditColor('');
    };

    const saveEdit = async () => {
        if (!editName.trim()) return;
        await updatePerson(editingId, editName.trim(), editColor);
        cancelEdit();
    };

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') cancelEdit();
    };

    return (
        <div className="people-manager">
            <div className="people-manager__header">
                <h2>People</h2>
                <span className="people-manager__count">{people.length}</span>
            </div>

            {/* List */}
            <div className="people-manager__list">
                {people.length === 0 ? (
                    <div className="people-manager__empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                        </svg>
                        <p>No contacts yet</p>
                        <span>Add people below to reuse them across receipts</span>
                    </div>
                ) : (
                    people.map(person => (
                        <div key={person._id} className="person-card">
                            {editingId === person._id ? (
                                <div className="person-card__edit">
                                    <div className="person-card__edit-colors">
                                        {COLOR_OPTIONS.map(c => (
                                            <button
                                                key={c}
                                                className={`color-swatch ${editColor === c ? 'color-swatch--active' : ''}`}
                                                style={{ background: c }}
                                                onClick={() => setEditColor(c)}
                                            />
                                        ))}
                                    </div>
                                    <div className="person-card__edit-row">
                                        <Avatar name={editName || person.name} color={editColor} />
                                        <input
                                            className="person-card__input"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            onKeyDown={handleEditKeyDown}
                                            autoFocus
                                        />
                                        <button className="btn btn--sm btn--primary" onClick={saveEdit}>Save</button>
                                        <button className="btn btn--sm btn--ghost" onClick={cancelEdit}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="person-card__row">
                                    <Avatar name={person.name} color={person.color} />
                                    <span className="person-card__name">{person.name}</span>
                                    <div className="person-card__actions">
                                        <button className="btn btn--sm btn--ghost" onClick={() => startEdit(person)}>Edit</button>
                                        <button
                                            className="btn btn--sm btn--danger"
                                            onClick={() => setDeleteTarget(person)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Add New */}
            <div className="people-manager__add">
                <p className="people-manager__add-label">Add person</p>
                <div className="people-manager__add-colors">
                    {COLOR_OPTIONS.map(c => (
                        <button
                            key={c}
                            className={`color-swatch ${newColor === c ? 'color-swatch--active' : ''}`}
                            style={{ background: c }}
                            onClick={() => setNewColor(c)}
                        />
                    ))}
                </div>
                <div className="people-manager__add-row">
                    <Avatar name={newName || '+'} color={newColor} />
                    <input
                        className="person-card__input"
                        placeholder="Name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        className="btn btn--sm btn--primary"
                        onClick={handleAdd}
                        disabled={!newName.trim()}
                    >
                        Add
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={async () => {
                    await deletePerson(deleteTarget._id);
                    setDeleteTarget(null);
                }}
                message={`Remove ${deleteTarget?.name} from contacts?`}
            />
        </div>
    );
};

export default PeopleManager;
