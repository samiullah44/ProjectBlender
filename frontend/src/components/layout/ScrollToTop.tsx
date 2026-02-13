import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Component that scrolls the window to the top on every route change.
 * It should be placed inside the Router.
 */
const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

export default ScrollToTop;
