const API_URL = 'http://localhost:4000/api/recepciones';

// El endpoint y los nombres de campos deben confirmarse con el backend.
// Este servicio queda aislado para poder ajustarlo sin modificar los componentes.
async function responseData(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'No se pudo registrar la recepción.');
  }
  return data;
}

export async function registrarRecepcion(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return responseData(response);
}
