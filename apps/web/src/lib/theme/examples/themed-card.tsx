'use client';

/**
 * Example Themed Card Component
 * Demonstrates how to use theme system in components
 */

import {
  useTheme,
  useThemeColor,
  useComponentStyles,
  useBorderRadius,
  useSpacing,
} from '../use-theme';

interface ThemedCardProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: React.ReactNode;
}

export function ThemedCard({ title, description, action, children }: ThemedCardProps) {
  const { theme } = useTheme();
  const cardColor = useThemeColor('card');
  const cardForeground = useThemeColor('cardForeground');
  const primaryColor = useThemeColor('primary');
  const borderColor = useThemeColor('border');
  const { cardStyle, cardShadow } = useComponentStyles();
  const borderRadius = useBorderRadius();
  const spacing = useSpacing();

  // Build card styles based on theme
  const cardStyles: React.CSSProperties = {
    backgroundColor: cardColor,
    color: cardForeground,
    borderRadius,
    padding: spacing,
    border: cardStyle === 'outlined' ? `1px solid ${borderColor}` : 'none',
    boxShadow:
      cardStyle === 'elevated'
        ? cardShadow === 'lg'
          ? '0 10px 15px -3px rgb(0 0 0 / 0.1)'
          : '0 4px 6px -1px rgb(0 0 0 / 0.1)'
        : 'none',
  };

  const buttonStyles: React.CSSProperties = {
    backgroundColor: primaryColor,
    color: '#ffffff',
    padding: '0.5rem 1rem',
    borderRadius,
    border: 'none',
    cursor: 'pointer',
    fontFamily: theme?.fontFamily,
    fontSize: theme?.fontSize === 'sm' ? '14px' : theme?.fontSize === 'lg' ? '18px' : '16px',
  };

  return (
    <div style={cardStyles}>
      <h3
        style={{
          margin: '0 0 0.5rem 0',
          fontFamily: theme?.headingFont || theme?.fontFamily,
          fontSize: theme?.fontSize === 'sm' ? '18px' : theme?.fontSize === 'lg' ? '24px' : '20px',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: '0 0 1rem 0',
          color: cardForeground,
          opacity: 0.8,
        }}
      >
        {description}
      </p>

      {children}

      {action && (
        <button onClick={action.onClick} style={buttonStyles}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Example: Themed Button Component
 */
export function ThemedButton({
  children,
  onClick,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'accent';
}) {
  const { theme } = useTheme();
  const color = useThemeColor(variant);
  const { buttonStyle, buttonRounding } = useComponentStyles();

  const radiusMap = {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  };

  const styles: React.CSSProperties = {
    backgroundColor: buttonStyle === 'solid' ? color : 'transparent',
    color: buttonStyle === 'solid' ? '#ffffff' : color,
    border: buttonStyle === 'outline' ? `2px solid ${color}` : 'none',
    padding: '0.5rem 1.5rem',
    borderRadius: radiusMap[buttonRounding || 'md'],
    cursor: 'pointer',
    fontFamily: theme?.fontFamily,
    fontSize: theme?.fontSize === 'sm' ? '14px' : theme?.fontSize === 'lg' ? '18px' : '16px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  };

  return (
    <button onClick={onClick} style={styles}>
      {children}
    </button>
  );
}

/**
 * Example: Themed Input Component
 */
export function ThemedInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { theme } = useTheme();
  const inputColor = useThemeColor('input');
  const foreground = useThemeColor('foreground');
  const borderColor = useThemeColor('border');
  const { inputStyle } = useComponentStyles();
  const borderRadius = useBorderRadius();
  const spacing = useSpacing();

  const styles: React.CSSProperties = {
    backgroundColor: inputStyle === 'filled' ? inputColor : 'transparent',
    color: foreground,
    border:
      inputStyle === 'outlined'
        ? `1px solid ${borderColor}`
        : inputStyle === 'underlined'
          ? 'none'
          : '1px solid transparent',
    borderBottom: inputStyle === 'underlined' ? `2px solid ${borderColor}` : undefined,
    borderRadius: inputStyle === 'underlined' ? '0' : borderRadius,
    padding: spacing,
    fontFamily: theme?.fontFamily,
    fontSize: theme?.fontSize === 'sm' ? '14px' : theme?.fontSize === 'lg' ? '18px' : '16px',
    width: '100%',
    outline: 'none',
  };

  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles}
    />
  );
}

/**
 * Example: Theme Preview Component
 */
export function ThemePreview() {
  const { theme } = useTheme();

  if (!theme) return null;

  return (
    <div style={{ padding: '2rem', fontFamily: theme.fontFamily }}>
      <h1
        style={{
          fontFamily: theme.headingFont || theme.fontFamily,
          fontSize: theme.fontSize === 'sm' ? '32px' : theme.fontSize === 'lg' ? '40px' : '36px',
          marginBottom: '2rem',
        }}
      >
        {theme.name}
      </h1>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <ThemedCard
          title="Primary"
          description="Primary color showcase"
          action={{
            label: 'Click Me',
            onClick: () => alert('Primary clicked!'),
          }}
        />

        <ThemedCard title="Secondary" description="Secondary color showcase">
          <ThemedButton variant="secondary">Secondary Button</ThemedButton>
        </ThemedCard>

        <ThemedCard title="Accent" description="Accent color showcase">
          <ThemedButton variant="accent">Accent Button</ThemedButton>
        </ThemedCard>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2
          style={{
            fontFamily: theme.headingFont || theme.fontFamily,
            marginBottom: '1rem',
          }}
        >
          Typography
        </h2>
        <p style={{ fontSize: theme.fontSize === 'sm' ? '14px' : theme.fontSize === 'lg' ? '18px' : '16px' }}>
          This is a paragraph with the base font size. The quick brown fox jumps over the lazy dog.
        </p>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2
          style={{
            fontFamily: theme.headingFont || theme.fontFamily,
            marginBottom: '1rem',
          }}
        >
          Form Elements
        </h2>
        <ThemedInput
          placeholder="Enter some text..."
          value=""
          onChange={() => {}}
        />
      </div>

      <div
        style={{
          marginTop: '2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: '0.5rem',
        }}
      >
        <h2
          style={{
            gridColumn: '1 / -1',
            fontFamily: theme.headingFont || theme.fontFamily,
            marginBottom: '0.5rem',
          }}
        >
          Color Palette
        </h2>
        {Object.entries(theme.colors).map(([name, color]) => (
          <div
            key={name}
            style={{
              backgroundColor: color,
              padding: '1rem',
              borderRadius: '0.5rem',
              textAlign: 'center',
              color: '#fff',
              fontSize: '12px',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
