# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Participantes (audiencia principal):** Escritores hispanohablantes —miembros del club de escritura SiTeLoCuento e invitados externos— que buscan un reto creativo en comunidad, con plazos claros y acompañamiento en cada etapa.
- **Jurado (`JURY`):** Evaluadores independientes activos exclusivamente en las etapas de Evaluación del Jurado y Desempate; leen de forma anónima los cuentos finalistas (Top 10 + empates) y votan el podio (1.º, 2.º y 3.º lugar).
- **Administradores (`ADMIN`):** Miembros del equipo organizador que proponen y validan consignas, monitorean estadísticas, revisan similitud entre borradores originales y editados, gestionan alertas de modificación excesiva e intervienen en casos excepcionales con registro de auditoría.
- **Superadministrador (`SUPERADMIN`):** Responsable raíz de la plataforma; configura ediciones anuales, calendario, parámetros del concurso, plantillas de correo, páginas informativas públicas y asignación de roles globales.

## Product Purpose

**Olimpíadas Literarias** es la plataforma web del concurso anual de relatos cortos organizado por el club de escritura **SiTeLoCuento**. Centraliza todo el ciclo de vida de cada edición —inscripción, maratón de escritura por consignas, selección y edición final, revisión editorial, votación anónima entre pares, fallo del jurado y publicación de ganadores— manteniendo cuentas permanentes de usuario y un archivo histórico público de cuentos.

El éxito del producto se mide por lograr **alta participación y cuentos completados sin fricción**, permitiendo que los autores se concentren en escribir, leer y celebrar historias sin confusión sobre plazos, reglas o estado de su participación.

## Positioning

A diferencia de concursos literarios tradicionales por correo electrónico o formularios genéricos, Olimpíadas Literarias integra en un solo flujo un **maratón de escritura por consignas con plazos escalonados**, **verificación automática de integridad editorial** (comparación por similitud entre el borrador original y el cuento postulado), **votación anónima entre pares** y **evaluación ciega del jurado con desempate condicional**, todo respaldado por la comunidad de SiTeLoCuento.

## Operating Context

- **Idioma:** 100 % en español (interfaz, validaciones, mensajes del sistema y correos electrónicos).
- **Zona horaria oficial:** `America/Caracas` (UTC-4) para todas las transiciones de etapa, cierres de consignas y recordatorios automáticos.
- **Dispositivos:** Acceso desde escritorio, tableta y móvil (especialmente relevante durante lectura, votación y escritura en sesiones cortas).
- **Ciclo anual secuencial:** Etapas estrictamente secuenciales sin solapamientos y con dos ventanas obligatorias de 48 horas (entre escritura y postulación, y entre revisión administrativa y votaciones, incluyendo ventana de corrección de 24 horas).
- **Cuentas permanentes vs. inscripción por edición:** Crear cuenta no inscribe automáticamente en la edición activa; el participante debe inscribirse explícitamente durante la etapa de Inscripciones.

## Capabilities and Constraints

- **Autenticación y perfil:** Correo/contraseña con verificación de correo y recuperación de clave, más OAuth con Google y Microsoft. Campos obligatorios de perfil (`first_name`, `last_name`, `country`, `email`, `phone`) con pantalla obligatoria de completar perfil tras primer ingreso OAuth; foto de perfil opcional (visible en el podio si el autor resulta ganador).
- **Exclusividad de roles:** Usuarios con rol `SUPERADMIN`, `ADMIN` o `JURY` no pueden inscribirse ni participar como autores mientras mantengan ese rol.
- **Etapas y controles:** Autoguardado local en escritura, conteo de caracteres en vivo, comparación Myers diff entre versión original y editada, votación anónima con orden determinista por participante (`fnv1a32`) y podio Top 3, evaluación del jurado sobre Top 10 + empates sin ver conteos de pares, y archivo público permanente de ediciones y ganadores.
- **Restricciones técnicas y operativas:** Desplegado en Cloudflare Workers (Next.js 15 App Router + D1/Drizzle + R2 + Cron cada 5 minutos + correos vía Brevo). Los cambios de contenido en páginas públicas (*Bases del Concurso*, *¿Quiénes somos?*) y plantillas de correo son editables por el Superadministrador.

## Brand Commitments

- **Nombre oficial en la interfaz:** **Olimpíadas Literarias** (no usar "Olimpíadas Literarias de SiTeLoCuento" en títulos ni encabezados de la interfaz; **SiTeLoCuento** se menciona únicamente como el club organizador).
- **Voz y tono:** Cercana, alentadora y moderna —tuteo amigable, clara y sin solemnidad académica.
- **Compromisos de textos aprobados en portada:**
  - Un único botón principal de acceso en la barra superior llamado **`Entrar`** (desde esa pantalla se inicia sesión o se crea cuenta; no duplicar botones debajo del emblema ni repetir el título del concurso en el centro del hero).
  - Sección explicativa de etapas titulada *"Tres pasos, un solo cuento"* con estructura de 3 niveles por etapa: `Primera Etapa: Escritura`, `Segunda Etapa: Postulación` y `Tercera Etapa: Veredicto`.

## Evidence on Hand

- **Documentación funcional y técnica:** `docs/FUNCTIONAL_SPECIFICATION_AGENT.md`, `docs/TECHNICAL_SPECIFICATION.md`, `docs/GUIA_FUNCIONAL_ORGANIZADORES.md`.
- **Entorno desplegado de pruebas:** Cloudflare Workers (`olimpiadas-stlc-dev`) con 50 rutas activas y base de datos D1.
- **Activos oficiales integrados:**
  - Emblema vectorial oficial del certamen: `public/images/logo-olimpiadas.svg` (y `src/app/icon.svg` como favicon).
  - Logo oficial del club organizador: `public/images/logo-sitelocuento.png`.
- **Ausencias confirmadas (no inventar):**
  - No existen testimonios reales, menciones de prensa ni cifras históricas públicas verificadas; ninguna superficie debe fabricarlos.

## Product Principles

1. **Cero fricción al escribir y participar:** Cada participante debe saber al instante en qué etapa está el concurso, cuál es su estado personal y qué acción concreta le toca hacer.
2. **Juego limpio e imparcialidad verificable:** Anonimato estricto en votaciones, reglas claras de edición respaldadas por comparación objetiva y separación absoluta entre organizadores, jurado y autores.
3. **Comunidad cercana antes que solemnidad:** Acompañar el proceso creativo con calidez, claridad y energía sin intimidar a nuevos escritores.
4. **Memoria viva de cada edición:** Dar protagonismo a las historias y a sus autores en un archivo público claro y perdurable una vez publicados los resultados.

## Accessibility & Inclusion

- Experiencia 100 % responsiva en escritorio, tableta y móvil.
- Localización completa en español (`es`) en toda la interfaz, etiquetas, errores y notificaciones.
