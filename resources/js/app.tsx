import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

interface InitialPageProps {
    app?: {
        name?: string;
    };
}

interface InitialPage {
    props?: InitialPageProps;
}

const initialPage = (() => {
    const page = document.getElementById('app')?.dataset.page;

    if (!page) {
        return null;
    }

    try {
        return JSON.parse(page) as InitialPage;
    } catch {
        return null;
    }
})();

const appName = (
    initialPage?.props?.app?.name ||
    import.meta.env.VITE_APP_NAME ||
    'Laravel'
).trim();

createInertiaApp({
    title: (title) => {
        const pageTitle = title.trim();

        return pageTitle ? `${appName} - ${pageTitle}` : appName;
    },
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});
