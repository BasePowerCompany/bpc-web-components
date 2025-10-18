## Address Search

Autocomplete based address search.

### Params
- `placeholder` - Adjust the placeholder text on the input (default: "Enter your home address")
- `cta` - Adds the call-to-action button with the defined text (default: undefined -- no CTA)
- `public-key` - The Google Maps API key to load the component with

### Events
- `select` - Fired when an address is selected
- `result` - Fired once the server responds with the data related to the selection
- `error` - Fired if an error occurs communicating with the server or a server error is returned
