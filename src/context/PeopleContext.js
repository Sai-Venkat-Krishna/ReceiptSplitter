import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useToast } from './ToastContext';

const PeopleContext = createContext(null);

export const usePeople = () => useContext(PeopleContext);

// Cycle through a palette for auto-assigned avatar colors
const COLOR_PALETTE = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981',
    '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
];

let colorIndex = 0;
const nextColor = () => COLOR_PALETTE[colorIndex++ % COLOR_PALETTE.length];

export const PeopleProvider = ({ children }) => {
    const [people, setPeople] = useState([]);
    const { addToast } = useToast();

    const fetchPeople = useCallback(async () => {
        try {
            const res = await axios.get('/api/people');
            setPeople(res.data);
        } catch {
            addToast('Failed to load contacts', 'error');
        }
    }, [addToast]);

    useEffect(() => {
        fetchPeople();
    }, [fetchPeople]);

    const addPerson = useCallback(async (name, color) => {
        const assignedColor = color || nextColor();
        try {
            const res = await axios.post('/api/people', { name: name.trim(), color: assignedColor });
            setPeople(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
            return res.data;
        } catch {
            addToast('Failed to save contact', 'error');
            return null;
        }
    }, [addToast]);

    const updatePerson = useCallback(async (id, name, color) => {
        try {
            const res = await axios.put(`/api/people/${id}`, { name: name.trim(), color });
            setPeople(prev =>
                prev.map(p => p._id === id ? res.data : p)
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
        } catch {
            addToast('Failed to update contact', 'error');
        }
    }, [addToast]);

    const deletePerson = useCallback(async (id) => {
        try {
            await axios.delete(`/api/people/${id}`);
            setPeople(prev => prev.filter(p => p._id !== id));
        } catch {
            addToast('Failed to delete contact', 'error');
        }
    }, [addToast]);

    return (
        <PeopleContext.Provider value={{ people, addPerson, updatePerson, deletePerson }}>
            {children}
        </PeopleContext.Provider>
    );
};
