import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  subLabel?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  autoFocus?: boolean;
  onComplete?: () => void;
  id?: string;
  name?: string;
}

export interface SearchableSelectRef {
  focus: () => void;
}

const SearchableSelect = forwardRef<SearchableSelectRef, SearchableSelectProps>(({ 
  options, value, onChange, placeholder, label, className, autoFocus, onComplete, id, name
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  
  const uniqueId = useMemo(() => id || `select-${Math.random().toString(36).substr(2, 9)}`, [id]);
  const inputName = name || uniqueId;

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    }
  }));

  // تحسين الأداء: الفلترة والتقليص (عرض أول 100 نتيجة فقط لتسريع المتصفح)
  const filteredOptions = useMemo(() => {
    if (!searchTerm && !isOpen) return [];
    const filtered = options.filter(opt => 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    return filtered.slice(0, 100); 
  }, [options, searchTerm, isOpen]);

  useEffect(() => {
    if (!value) {
      setSearchTerm('');
    } else {
      const selected = options.find(o => o.value === value);
      if (selected && !isOpen) {
        setSearchTerm(selected.label);
      }
    }
  }, [value, options, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const selected = options.find(o => o.value === value);
        setSearchTerm(selected ? selected.label : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % Math.max(1, filteredOptions.length));
      setIsOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % Math.max(1, filteredOptions.length));
      setIsOpen(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredOptions.length > 0) {
        const optionToSelect = filteredOptions[highlightedIndex];
        if (optionToSelect) selectOption(optionToSelect);
      } else {
         setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const selectOption = (opt: Option) => {
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setSearchTerm(opt.label);
    setIsOpen(false);
    if (onComplete) onComplete();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={uniqueId} className="block text-sm font-bold text-slate-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={uniqueId}
          name={inputName}
          ref={inputRef}
          type="text"
          autoComplete="off"
          className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border p-2.5 pr-10 font-bold bg-slate-50 focus:bg-white transition-all"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
            if(e.target.value === '') onChange('');
          }}
          onFocus={() => {
              setIsOpen(true);
              inputRef.current?.select();
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
        />
        <Search className="absolute right-3 top-3 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul 
          ref={listRef}
          className="absolute z-[100] w-full bg-white mt-1 border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto overflow-x-hidden scroll-smooth animate-in fade-in slide-in-from-top-1"
        >
          {filteredOptions.map((opt, idx) => (
            <li
              key={opt.value}
              className={`px-4 py-3 cursor-pointer flex justify-between items-center text-sm border-b border-slate-50 last:border-0
                ${opt.disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
                ${idx === highlightedIndex ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}
              `}
              onClick={() => selectOption(opt)}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              <div>
                <div className="font-bold">{opt.label}</div>
                {opt.subLabel && <div className={`text-[10px] font-mono ${idx === highlightedIndex ? 'text-slate-300' : 'text-slate-400'}`}>{opt.subLabel}</div>}
              </div>
              {value === opt.value && <Check className={`w-4 h-4 ${idx === highlightedIndex ? 'text-white' : 'text-blue-600'}`} />}
            </li>
          ))}
          {options.length > 100 && filteredOptions.length === 100 && (
              <li className="px-4 py-2 text-[10px] text-center text-slate-400 bg-slate-50 font-bold">
                  اكتب المزيد لتخصيص البحث (يعرض 100 من {options.length})
              </li>
          )}
        </ul>
      )}
    </div>
  );
});

export default SearchableSelect;