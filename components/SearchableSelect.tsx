
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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
  onComplete?: () => void; // Triggered after selection via Enter
}

export interface SearchableSelectRef {
  focus: () => void;
}

const SearchableSelect = forwardRef<SearchableSelectRef, SearchableSelectProps>(({ 
  options, value, onChange, placeholder, label, className, autoFocus, onComplete 
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null); // Ref for the scrollable list

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    }
  }));

  // Filter options
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sync internal search term with external value change (if value is cleared externally)
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

  // Handle Outside Click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Revert search term to selected value if no new selection made
        const selected = options.find(o => o.value === value);
        setSearchTerm(selected ? selected.label : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && filteredOptions.length > 0) {
      const list = listRef.current;
      // Ensure index is within bounds
      const safeIndex = Math.min(highlightedIndex, filteredOptions.length - 1);
      const element = list.children[safeIndex] as HTMLElement;
      
      if (element) {
        // Calculate bounds
        const elementTop = element.offsetTop;
        const elementBottom = elementTop + element.clientHeight;
        const listTop = list.scrollTop;
        const listBottom = listTop + list.clientHeight;

        // Scroll Down
        if (elementBottom > listBottom) {
          list.scrollTop = elementBottom - list.clientHeight;
        }
        // Scroll Up
        else if (elementTop < listTop) {
          list.scrollTop = elementTop;
        }
      }
    }
  }, [highlightedIndex, isOpen, filteredOptions.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
      setIsOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
      setIsOpen(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredOptions.length > 0) {
        const optionToSelect = filteredOptions[highlightedIndex];
        if (optionToSelect) {
            selectOption(optionToSelect);
        }
      } else {
         // If closed but Enter pressed, toggle open
         setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Tab') {
        setIsOpen(false);
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
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2 pr-8"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
            if(e.target.value === '') onChange(''); // Clear selection if input cleared
          }}
          onFocus={() => {
              setIsOpen(true);
              // Select all text on focus for easier replacement
              inputRef.current?.select();
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul 
          ref={listRef}
          className="absolute z-50 w-full bg-white mt-1 border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto scroll-smooth"
        >
          {filteredOptions.map((opt, idx) => (
            <li
              key={opt.value}
              className={`px-4 py-2 cursor-pointer flex justify-between items-center text-sm
                ${opt.disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-blue-50'}
                ${idx === highlightedIndex ? 'bg-blue-100 text-blue-900' : 'text-gray-700'}
              `}
              onClick={() => selectOption(opt)}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              <div>
                <div className="font-medium">{opt.label}</div>
                {opt.subLabel && <div className="text-xs text-gray-500">{opt.subLabel}</div>}
              </div>
              {value === opt.value && <Check className="w-4 h-4 text-blue-600" />}
            </li>
          ))}
        </ul>
      )}
      {isOpen && filteredOptions.length === 0 && (
          <div className="absolute z-50 w-full bg-white mt-1 border border-gray-200 rounded-lg shadow-lg p-3 text-center text-sm text-gray-500">
              No results found
          </div>
      )}
    </div>
  );
});

export default SearchableSelect;
