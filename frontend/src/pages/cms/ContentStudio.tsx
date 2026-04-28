import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const PostListView = React.lazy(() => import('./PostListView'));
const PostEditorView = React.lazy(() => import('./PostEditorView'));

const ContentStudio = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route index element={<PostListView />} />
        <Route path="new" element={<PostEditorView />} />
        <Route path=":id/edit" element={<PostEditorView />} />
      </Routes>
    </Suspense>
  );
};

export default ContentStudio;
