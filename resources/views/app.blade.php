<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        @php
            $socialTitle = '$SIGMA Vault';
            $socialDescription = 'Enter the vault. Join the culture.';
            $socialUrl = 'https://vault.sigmalabz.xyz';
            $socialImage = $socialUrl.'/images/og/sigma-vault-og.jpg';
            $socialImageAlt = '$SIGMA Vault social preview artwork';
        @endphp

        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#000000">
        <meta name="description" content="{{ $socialDescription }}">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>
        <link rel="canonical" href="{{ $socialUrl }}">

        <meta property="og:title" content="{{ $socialTitle }}">
        <meta property="og:description" content="{{ $socialDescription }}">
        <meta property="og:type" content="website">
        <meta property="og:url" content="{{ $socialUrl }}">
        <meta property="og:site_name" content="{{ $socialTitle }}">
        <meta property="og:image" content="{{ $socialImage }}">
        <meta property="og:image:secure_url" content="{{ $socialImage }}">
        <meta property="og:image:type" content="image/jpeg">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:image:alt" content="{{ $socialImageAlt }}">

        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="{{ $socialTitle }}">
        <meta name="twitter:description" content="{{ $socialDescription }}">
        <meta name="twitter:image" content="{{ $socialImage }}">
        <meta name="twitter:image:alt" content="{{ $socialImageAlt }}">

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/images/favicons/favicon.svg" type="image/svg+xml">
        <link rel="icon" href="/images/favicons/favicon-96x96.png" type="image/png" sizes="96x96">
        <link rel="shortcut icon" href="/favicon.ico">
        <link rel="apple-touch-icon" href="/images/favicons/apple-touch-icon.png" sizes="180x180">
        <link rel="manifest" href="/site.webmanifest">

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
