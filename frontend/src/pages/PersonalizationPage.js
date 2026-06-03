import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { PersonalizationSettings } from '../components/settings/PersonalizationSettings';

export default function PersonalizationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Personalization"
        description="Choose your own theme, glass mode, and accent color"
      />
      <PersonalizationSettings allowWallpaper={false} />
    </div>
  );
}
