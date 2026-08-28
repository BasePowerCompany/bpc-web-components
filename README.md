# BPC Web Components

Web components that provide additional functionality for the marketing website.

### Development

Create a `.env.development` file at the root of this project. Include your Google Maps API key like:
```
VITE_GOOGLE_MAPS_API_KEY=<apiKey>
```

Then run:
```
npm install
npm run dev
```

### Deployment

This is hosted via jsdelivr. To support the delivery of the JS files, the built files _must_ be checked in. 

### Release
- This should follow SemVer- new features should only be released in minor versions.
