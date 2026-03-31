interface Props {
  svg: string | null;
  loading: boolean;
  error: string | null;
}

export default function ArtworkPreview({ svg, loading, error }: Props) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <p>Generating artwork…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: 'red', padding: 16 }} role="alert">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#888' }}>
        <p>Draw a boundary on the map to generate your artwork.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="artwork-preview"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}
    />
  );
}
