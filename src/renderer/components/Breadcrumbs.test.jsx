import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Breadcrumbs from './Breadcrumbs';

describe('Breadcrumbs', () => {
  it('returns null when no path and no name', () => {
    const { container } = render(<Breadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it('renders name only when no path', () => {
    render(<Breadcrumbs name="app.js" />);
    expect(screen.getByText('app.js')).toBeInTheDocument();
  });

  it('renders path segments and file name', () => {
    render(<Breadcrumbs path="src/components/Button.jsx" name="Button.jsx" />);
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('components')).toBeInTheDocument();
    expect(screen.getByText('Button.jsx')).toBeInTheDocument();
  });

  it('normalizes backslashes to path segments', () => {
    render(<Breadcrumbs path="src\\components\\File.js" />);
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('components')).toBeInTheDocument();
    expect(screen.getByText('File.js')).toBeInTheDocument();
  });

  it('uses name over last segment when both provided', () => {
    render(<Breadcrumbs path="a/b/c" name="Custom" />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });
});
