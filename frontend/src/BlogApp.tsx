// BlogApp.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import BlogHome from './pages/blog/BlogHome';
import BlogPost from './pages/blog/BlogPost';

const BlogApp = () => {
  return (
    <Routes>
      <Route path="/" element={<BlogHome />} />
      <Route path="/:slug" element={<BlogPost />} />
      <Route path="*" element={<BlogHome />} />
    </Routes>
  );
};

export default BlogApp;