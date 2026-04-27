const DISTRICT_COORDS = {
  Colombo: { lat: 6.9271, lon: 79.8612 },
  Gampaha: { lat: 7.0873, lon: 79.9999 },
  Kalutara: { lat: 6.5854, lon: 79.9607 },
  Kandy: { lat: 7.2906, lon: 80.6337 },
  Matale: { lat: 7.4675, lon: 80.6234 },
  "Nuwara Eliya": { lat: 6.9497, lon: 80.7891 },
  Galle: { lat: 6.0535, lon: 80.221 },
  Matara: { lat: 5.9549, lon: 80.555 },
  Hambantota: { lat: 6.1248, lon: 81.1185 },
  Jaffna: { lat: 9.6615, lon: 80.0255 },
  Trincomalee: { lat: 8.5874, lon: 81.2152 },
  Kurunegala: { lat: 7.4818, lon: 80.3609 },
  Puttalam: { lat: 8.0362, lon: 79.8283 },
  Anuradhapura: { lat: 8.3114, lon: 80.4037 },
  Polonnaruwa: { lat: 7.9403, lon: 81.0188 },
  Badulla: { lat: 6.9934, lon: 81.055 },
  Ratnapura: { lat: 6.6828, lon: 80.3992 },
  Kegalle: { lat: 7.2513, lon: 80.3464 },
};

export async function getWeather(district) {
  const coord = DISTRICT_COORDS[district] || DISTRICT_COORDS.Colombo;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lon}&current=temperature_2m,relative_humidity_2m,precipitation&timezone=Asia%2FColombo`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Weather fetch failed");
  }

  const data = await response.json();
  return {
    temp: Math.round((data.current?.temperature_2m ?? 29) * 10) / 10,
    humidity: Math.round(data.current?.relative_humidity_2m ?? 75),
    rain: Math.round((data.current?.precipitation ?? 0) * 10) / 10,
  };
}