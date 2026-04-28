import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BlogHome from './pages/blog/BlogHome';
import BlogPost from './pages/blog/BlogPost';

export const BlogApp = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BlogHome />} />
        <Route path="/:slug" element={<BlogPost />} />
        <Route path="*" element={<BlogHome />} />
      </Routes>
    </Router>
  );
};

export default BlogApp;
