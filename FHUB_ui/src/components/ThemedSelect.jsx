import { Children, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export default function ThemedSelect({ children, value, onChange, name, disabled, compact = false, ...props }) {
  const options = Children.toArray(children).filter(Boolean).map(child => ({
    value: String(child.props.value ?? child.props.children),
    label: child.props.children,
    disabled: child.props.disabled,
  }));
  const selected = options.findIndex(option => option.value === String(value ?? ''));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({});
  const trigger = useRef(null);
  const popup = useRef(null);
  const search = useRef({ text: '', time: 0 });
  const id = useId();

  function show() {
    if (disabled) return;
    const rect = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const upwards = below < 180 && above > below;
    const width = Math.min(Math.max(rect.width, compact ? 165 : 190), window.innerWidth - 24);
    setPosition({ position: 'fixed', width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      ...(upwards ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      maxHeight: Math.max(44, Math.min(300, upwards ? above : below)) });
    setActive(selected >= 0 ? selected : Math.max(0, options.findIndex(option => !option.disabled)));
    setOpen(true);
  }
  function choose(index) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange?.({ target: { name, value: option.value }, currentTarget: { name, value: option.value } });
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const outside = event => {
      if (!trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false);
    };
    const scroll = event => { if (!popup.current?.contains(event.target)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  useEffect(() => {
    if (open) popup.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function keyDown(event) {
    if (event.key === 'Escape') { if (open) { event.stopPropagation(); event.preventDefault(); setOpen(false); } return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (open) choose(active); else show();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      const enabled = options.map((option, i) => option.disabled ? -1 : i).filter(i => i >= 0);
      if (!enabled.length) return;
      const at = enabled.indexOf(active);
      setActive(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)
        : enabled[(at + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const text = (Date.now() - search.current.time > 700 ? '' : search.current.text) + event.key.toLowerCase();
      search.current = { text, time: Date.now() };
      const index = options.findIndex(option => !option.disabled && String(option.label).toLowerCase().startsWith(text));
      if (!open) show();
      if (index >= 0) setActive(index);
    }
  }

  return <>
    {name && <input type="hidden" name={name} value={value ?? ''} disabled={disabled} />}
    <button {...props} ref={trigger} type="button" className={`theme-select ${compact ? 'theme-select-compact' : ''} ${props.className || ''}`}
      role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled}
      onKeyDown={keyDown} onClick={() => open ? setOpen(false) : show()}>
      <span>{options[selected]?.label || 'Select an option'}</span><ChevronDown size={16} />
    </button>
    {open && createPortal(<div ref={popup} id={id} role="listbox" aria-label={props['aria-label'] || name || 'Options'}
      className={`theme-select-popup ${compact ? 'theme-select-popup-compact' : ''}`} style={position} onClick={event => event.stopPropagation()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} data-index={index}
        role="option" aria-selected={index === selected} aria-disabled={option.disabled || undefined}
        className={`theme-select-option ${index === active ? 'is-active' : ''}`}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span>{option.label}</span>{index === selected && <Check size={16} />}
      </div>)}
    </div>, document.body)}
  </>;
}
