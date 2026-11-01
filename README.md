# ParkHub

ParkHub es una aplicación web para consultar espacios de estacionamiento y administrar reservaciones. Usa Node.js, Express, TypeScript, MongoDB, Mongoose y una interfaz en HTML, CSS y JavaScript sin framework.

Esta rama es el **starter de la Práctica Integradora 2**. Las funciones anteriores están completas; la extensión de una reservación es el trabajo de esta práctica.

## Requisitos

- Node.js y npm instalados.
- Docker Desktop o una instalación compatible de Docker con Compose, para iniciar MongoDB. También puedes usar un servidor MongoDB local existente.

Ejecuta todos los comandos desde la raíz del proyecto.

## Instalación y arranque

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Inicia MongoDB:

   ```bash
   docker compose up -d
   ```

3. Opcional: copia `.env.example` a `.env` si necesitas cambiar el puerto o la conexión a MongoDB. Sin `.env`, la aplicación usa los valores de la tabla de configuración más abajo.

4. Carga cinco espacios de ejemplo. Puedes volver a ejecutar este comando sin duplicarlos:

   ```bash
   npm run seed
   ```

5. Inicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

6. Abre <http://localhost:3000> en el navegador.

Para detener el servidor de desarrollo, usa `Ctrl+C` en su terminal. Para detener MongoDB sin borrar el volumen de datos, ejecuta `docker compose down`.

### Ejecución compilada

```bash
npm run build
npm start
```

`npm run build` genera `dist/`. El servidor sigue sirviendo la página desde `src/public`, así que ejecuta `npm start` desde la raíz del proyecto.

## Configuración

| Variable | Valor predeterminado | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP de ParkHub |
| `MONGODB_URI` | `mongodb://localhost:27017/parkhub` | Conexión a MongoDB |

Si usas un MongoDB existente, configúralo en `MONGODB_URI` y omite el paso de Docker.

## Comandos disponibles

| Comando | Función |
| --- | --- |
| `npm run dev` | Inicia el servidor con recarga durante el desarrollo |
| `npm run seed` | Inserta o actualiza los cinco espacios de ejemplo |
| `npm run build` | Compila TypeScript en `dist/` |
| `npm start` | Ejecuta la versión compilada |
| `npm test` | Ejecuta las pruebas Jest una vez |
| `npm run test:watch` | Repite las pruebas Jest al guardar cambios |

## API

La API usa JSON y está disponible en el mismo puerto que la página. Las horas enviadas al servidor deben ser cadenas ISO 8601 con zona horaria. La interfaz convierte las horas locales antes de enviarlas.

| Método | Ruta | Estado actual |
| --- | --- | --- |
| `GET` | `/api/spots` | Lista los espacios activos. Cada elemento incluye `id`, `number`, `zone`, `type`, `active` y `available`. `available` describe la disponibilidad en este momento. |
| `GET` | `/api/spots/:id` | Consulta un espacio. Devuelve `404` si no existe. |
| `GET` | `/api/reservations` | Lista las reservaciones, incluidas las canceladas, con el número del espacio asociado cuando existe. |
| `POST` | `/api/reservations` | Crea una reservación. Devuelve `201` al crearla, `400` por datos inválidos, `404` si el espacio no existe o `409` si no puede reservarse. |
| `PATCH` | `/api/reservations/:id/cancel` | Cancela una reservación. Devuelve la reservación actualizada o `404` si no existe. |
| `PATCH` | `/api/reservations/:id/extend` | Extiende una reservación activa y vigente. Devuelve `200` con la reservación actualizada, `400` por una hora final inválida, `404` si la reservación no existe o `409` si no puede extenderse o hay conflicto. |

Para crear una reservación, primero consulta `GET /api/spots` y usa el `id` de uno de sus elementos:

```json
{
  "parkingSpotId": "ID_DEL_ESPACIO",
  "startTime": "FECHA_Y_HORA_ISO_DE_INICIO",
  "endTime": "FECHA_Y_HORA_ISO_DE_FIN"
}
```

Ejemplo de consulta rápida:

```bash
curl http://localhost:3000/api/spots
```

La API puede devolver `500` si ocurre un error inesperado. La disponibilidad de un espacio se calcula a partir de las reservaciones activas que abarcan el momento de la consulta. La agenda diaria de la página usa las reservaciones obtenidas de la API.

Para extender una reservación, envía su nueva hora final como una fecha y hora ISO 8601:

```json
{
  "endTime": "FECHA_Y_HORA_ISO_DE_FIN"
}
```

## Estructura del proyecto

```text
src/
  app.ts                         Configura Express y las rutas
  server.ts                      Conecta MongoDB e inicia HTTP
  seed.ts                        Carga espacios de ejemplo
  config/env.ts                  Lee la configuración
  features/parking-spots/        Modelo, servicio y rutas de espacios
  features/reservations/         Modelo, reglas, servicio y rutas de reservaciones
    __tests__/                   Pruebas Jest de funcionalidades anteriores
  public/                        Página, estilos y código del navegador
```

## Práctica Integradora 2

La historia de usuario se entrega por separado. Antes de programar, analízala, identifica las reglas y documenta tus casos de prueba. Después implementa la función, escribe tus propias pruebas Jest y registra los resultados de su ejecución.

Busca los comentarios `TODO PRACTICE 2` en las reglas, el servicio, la ruta y el código del navegador. Son puntos de trabajo, no respuestas. La suite completa de pruebas de extensión no está incluida en este starter.

Casos de prueba diseñados a partir de los criterios de aceptación:

| ID | Nombre del caso | Precondiciones | Entrada | Resultado esperado | Tipo |
| --- | --- | --- | --- | --- | --- |
| EXT-01 | Extensión válida | Reservación existente, `ACTIVE` y vigente; no hay otra reservación activa traslapada en el mismo espacio. | `endTime` válido y posterior al actual. | Responde `200`; se actualiza y persiste `endTime`, y se devuelve la reservación actualizada. | Servicio / API |
| EXT-02 | ID inválido o reservación inexistente | No hay una reservación localizable con el ID recibido. | ID mal formado o ID válido que no existe. | Responde `404`; no se modifica ninguna reservación. | Servicio / API |
| EXT-03 | Hora final inválida | Reservación existente, `ACTIVE` y vigente. | Fecha inválida, valor ausente o valor que no sea una fecha y hora válida. | Responde `400`; no se modifica la reservación. | Servicio / API |
| EXT-04 | Nueva hora igual a la hora final actual | Reservación existente, `ACTIVE` y vigente. | `endTime` igual a la hora final actual. | Responde `409`; no se modifica la reservación. | Regla / servicio |
| EXT-05 | Nueva hora anterior a la hora final actual | Reservación existente, `ACTIVE` y vigente. | `endTime` anterior a la hora final actual. | Responde `409`; no se modifica la reservación. | Regla / servicio |
| EXT-06 | Reservación con hora final ya transcurrida | Reservación existente cuyo `endTime` es anterior a la hora actual. | `endTime` posterior al final almacenado. | Responde `409`; no se modifica la reservación. | Regla / servicio |
| EXT-07 | Reservación no activa | Reservación existente con estado `CANCELLED`. | `endTime` válido y posterior al final almacenado. | Responde `409`; no se modifica la reservación. | Servicio / API |
| EXT-08 | Conflicto con otra reservación activa | Existe otra reservación `ACTIVE` en el mismo espacio cuyo horario traslapa el horario extendido. | `endTime` que alcanza o atraviesa el horario de la otra reservación. | Responde `409`; no se modifica la reservación solicitada. | Servicio / API |
| EXT-09 | La reservación no genera conflicto consigo misma | La reservación activa es la única que ocupa ese intervalo en el espacio. | `endTime` válido y posterior al final actual. | La propia reservación se excluye de la búsqueda de conflictos y la extensión se guarda. | Servicio |
| EXT-10 | Reservación cancelada no bloquea la extensión | Hay una reservación `CANCELLED` traslapada en el mismo espacio. | `endTime` válido que coincide con el intervalo cancelado. | La reservación cancelada no se considera conflicto y la extensión se guarda. | Servicio |
| EXT-11 | Intervalos adyacentes permitidos | Otra reservación activa del mismo espacio comienza exactamente al nuevo final, o termina exactamente al inicio de la reservación extendida. | Horarios que se tocan en un límite, sin traslaparse. | No hay conflicto; la extensión se guarda. | Regla / servicio |
| EXT-12 | Conflicto en otro espacio no bloquea | Hay una reservación activa traslapada, pero pertenece a otro espacio. | `endTime` válido y posterior al final actual. | No se considera conflicto por espacio distinto y la extensión se guarda. | Servicio |
| EXT-13 | Lista actualizada después de extender | La extensión responde correctamente y las consultas posteriores funcionan. | Envío de extensión desde la interfaz. | La interfaz informa éxito y refresca la lista de reservaciones y las vistas afectadas. | Frontend |
| EXT-14 | Error de extensión informado en la interfaz | El endpoint responde `400`, `404` o `409`, o falla la solicitud. | Envío de una extensión rechazada. | La interfaz informa el rechazo; no muestra éxito ni afirma que la lista fue actualizada. | Frontend |
