/* DEMO DATA ONLY - illustrative, not real clients. Replaced by ajax/projects/list.php when TF.DEMO_MODE = false.
   '#' links are placeholders you will replace with real addresses (live mode: an empty value shows a disabled button). */
const DEMO_PROJECTS = [
  ['Atlas Commerce', 'Web Application', 'A demo storefront with inventory dashboards.', ['PHP', 'MySQL', 'Bootstrap']],
  ['Orbit Booking', 'Mobile App', 'Demo appointment booking concept for small clinics.', ['Flutter', 'REST']],
  ['Lumen Studio', 'Website', 'Demo portfolio site for a creative studio.', ['HTML', 'CSS', 'JavaScript']],
  ['Pulse Analytics', 'Web Application', 'Demo analytics board with live charts.', ['JavaScript', 'PHP']],
  ['Nimbus Notes', 'Mobile App', 'Demo offline-first note taking app.', ['React Native', 'SQLite']],
  ['Verde Foundation', 'Website', 'Demo non-profit landing page with donation CTA.', ['HTML', 'Bootstrap']],
  ['Helix Design System', 'UI/UX Design', 'Demo component library and style guide.', ['Figma', 'CSS']],
  ['Kite Delivery', 'Mobile App', 'Demo courier tracking concept.', ['Kotlin', 'Maps API']]
].map(([name, category, short_description, technologies], i) => ({
  id: i + 1, name, category, short_description, technologies, image_url: `assets/images/projects/demo-${i + 1}.svg`, live_url: '#', github_url: '#',   // '#' = placeholder: replace with real URLs
 
  description: short_description + ' This is placeholder demo content - replace it from the admin panel once the backend is connected.'
}));
