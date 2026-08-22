const axios = require('axios');
axios.get('https://api.subdl.com/api/v1/subtitles', {
  params: { api_key: "subdl_B_aIO1H-jyorIqf4B-DtIA5OUE1EBuapUlJebKMc27g", imdb_id: "tt0111161", languages: "vi,en", type: "movie" }
}).then(r => console.log(JSON.stringify(r.data.subtitles[0], null, 2))).catch(e => console.error(e.message));
