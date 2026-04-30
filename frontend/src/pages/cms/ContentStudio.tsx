import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const PostListView = React.lazy(() => import('./PostListView'));
const PostEditorView = React.lazy(() => import('./PostEditorView'));
const CommentsView = React.lazy(() => import('./CommentsView'));

const ContentStudio = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="comments" element={<CommentsView />} />
        <Route index element={<PostListView />} />
        <Route path="new" element={<PostEditorView />} />
        <Route path=":id/edit" element={<PostEditorView />} />
        <Route path=":slug/comments" element={<CommentsView />} />
      </Routes>
    </Suspense>
  );
};

export default ContentStudio;
