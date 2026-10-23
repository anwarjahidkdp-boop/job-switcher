"use client";
import { useState, type InputHTMLAttributes } from 'react';

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return <span style={{ display: 'block', position: 'relative' }}>
    <input {...props} type={visible ? 'text' : 'password'} style={{ ...props.style, paddingRight: 76 }} />
    <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} aria-controls={props.id}
      onClick={() => setVisible(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: 'var(--accent)', cursor: 'pointer', font: 'inherit', fontSize: 13, padding: '6px 4px' }}>{visible ? 'Hide' : 'Show'}</button>
  </span>;
}
