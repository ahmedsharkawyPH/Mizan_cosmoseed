
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useId } from 'react';
import { Search, ChevronDown, Check, Zap, History, X } from 'lucide-react';
import { ArabicSmartSearch } from '../utils/search';

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
  minSearchChars?: number;
  disabled?: boolean;
  persistSearch?: boolean; // خاصية جديدة للحفاظ على النص بعد الاختيار
}

export interface SearchableSelectRef {
  focus: () => void;
  setInputValue: (val: string) => void;
}

const SearchableSelect = forwardRef<SearchableSelectRef, SearchableSelectProps>(({ 
  options, value, onChange, placeholder, label, className, autoFocus, onComplete, id, name, minSearchChars = 0, disabled = false, persistSearch = false
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  
  const generatedId = useId();
  const internalId = id || `searchable-${generatedId}`;
  const internalName = name || internalId;

  // تحميل سجل البحث من التخزين المحلي
  useEffect(() => {
    const savedHistory = localStorage.getItem(`search_hist_${internalId}`);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, [internalId]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    setInputValue: (val: string) => {
      setSearchTerm(val);
    }
  }));

  const filteredOptions = useMemo(() => {
    if (!isOpen) return [];
    
    const searchableItems = options.map(opt => ({
      ...opt,
      name: opt.label, 
      code: opt.subLabel || ''
    }));

    const results = ArabicSmartSearch.smartSearch(searchableItems, searchTerm);
    return results.slice(0, 100); 
  }, [options, searchTerm, isOpen]);

  // دالة حفظ كلمة البحث في السجل
  const addToHistory = (term: string) => {
    if (!term || term.trim().length < 2) return;
    const cleanTerm = term.trim();
    const newHistory = [cleanTerm, ...history.filter(h => h !== cleanTerm)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem(`search_hist_${internalId}`, JSON.stringify(newHistory));
  };

  useEffect(() => {
    if (isOpen && listRef.current && filteredOptions.length > 0) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex, isOpen, filteredOptions.length]);

  useEffect(() => {
    if (!value) {
      if (!isOpen && !persistSearch) setSearchTerm('');
    } else {
      const selected = options.find(o => o.value === value);
      if (selected && !isOpen) {
        setSearchTerm(selected.label);
      }
    }
  }, [value, options, isOpen, persistSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (!persistSearch) {
          const selected = options.find(o => o.value === value);
          setSearchTerm(selected ? selected.label : '');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options, persistSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex(prev => (prev + 1) % Math.max(1, filteredOptions.length));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % Math.max(1, filteredOptions.length));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredOptions.length > 0) {
        const optionToSelect = filteredOptions[highlightedIndex];
        if (optionToSelect) selectOption(optionToSelect as any);
      } else if (!isOpen) {
         setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const selectOption = (opt: Option) => {
    if (!opt || opt.disabled) return;
    
    // حفظ كلمة البحث الحالية قبل تغييرها لاسم الصنف
    if (searchTerm && searchTerm !== opt.label) {
        addToHistory(searchTerm);
    }

    onChange(opt.value);
    
    if (persistSearch) {
        // في وضع الحفاظ على البحث، لا نغير الـ Input ونتركه للاختيار التالي
    } else {
        setSearchTerm(opt.label);
    }
    
    setIsOpen(false);
    if (onComplete) onComplete();
  };

  const clearHistory = (e: React.MouseEvent) => {
      e.stopPropagation();
      setHistory([]);
      localStorage.removeItem(`search_hist_${internalId}`);
  };

  return (
    <div className={`relative ${className} ${disabled ? 'opacity-60 grayscale-[0.5]' : ''}`} ref={containerRef}>
      {label && (
        <label htmlFor={internalId} className={`block text-sm font-bold mb-1 ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={internalId}
          name={internalName}
          ref={inputRef}
          type="text"
          autoComplete="off"
          aria-label={label || placeholder}
          disabled={disabled}
          className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border p-2.5 pr-10 font-bold bg-slate-50 focus:bg-white transition-all disabled:cursor-not-allowed"
          placeholder={disabled ? "يرجى اختيار العميل أولاً..." : placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
            if(e.target.value === '') onChange('');
          }}
          onFocus={() => {
              if (!disabled) {
                setIsOpen(true);
                inputRef.current?.select();
              }
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
        />
        <Search className={`absolute right-3 top-3 w-4.5 h-4.5 pointer-events-none ${disabled ? 'text-slate-300' : 'text-slate-400'}`} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-[100] w-full bg-white mt-1 border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1">
          
          {/* قسم سجل البحث (History) */}
          {history.length > 0 && !searchTerm && (
              <div className="bg-slate-50/50 border-b border-slate-100">
                  <div className="px-4 py-2 flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">عمليات البحث الأخيرة</span>
                      <button onClick={clearHistory} className="text-[9px] font-black text-red-400 hover:text-red-600 transition-colors uppercase">مسح الكل</button>
                  </div>
                  <div className="px-2 pb-2 flex flex-wrap gap-1.5">
                      {history.map((term, i) => (
                          <button 
                            key={i} 
                            onClick={() => setSearchTerm(term)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all"
                          >
                              <History className="w-3 h-3" />
                              {term}
                          </button>
                      ))}
                  </div>
              </div>
          )}

          {filteredOptions.length > 0 ? (
            <ul 
              ref={listRef}
              role="listbox"
              className="overflow-y-auto scroll-smooth"
            >
              {filteredOptions.map((opt: any, idx) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={idx === highlightedIndex}
                  className={`px-4 py-3 cursor-pointer flex justify-between items-center text-sm border-b border-slate-50 last:border-0
                    ${opt.disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
                    ${idx === highlightedIndex ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}
                  `}
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className="flex-1">
                    <div className="font-bold flex items-center gap-2">
                       {opt.label}
                       {opt._searchScore > 50 && <Zap className={`w-3 h-3 ${idx === highlightedIndex ? 'text-yellow-400' : 'text-emerald-500'}`} />}
                    </div>
                    {opt.subLabel && (
                        <div className={`text-[11px] font-bold mt-0.5 leading-tight ${idx === highlightedIndex ? 'text-blue-300' : 'text-blue-600'}`}>
                            {opt.subLabel}
                        </div>
                    )}
                  </div>
                  {value === opt.value && <Check className={`w-4 h-4 ${idx === highlightedIndex ? 'text-white' : 'text-blue-600'}`} />}
                </li>
              ))}
            </ul>
          ) : (
            searchTerm.length >= minSearchChars && searchTerm.trim() !== '' && (
                <div className="p-8 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Search className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-400 font-bold">عفواً، لا توجد نتائج تطابق "{searchTerm}"</p>
                </div>
            )
          )}
        </div>
      )}
    </div>
  );
});

export default SearchableSelect;
