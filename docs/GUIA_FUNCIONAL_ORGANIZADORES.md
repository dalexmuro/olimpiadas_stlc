# Guía de Funcionamiento de la Plataforma Web "Olimpíadas Literarias de SiTeLoCuento"

[English](ORGANIZER_FUNCTIONAL_GUIDE.md) | **Español**

**Documento para el Equipo Organizador — Club de Escritura SiTeLoCuento**

---

## 1. Introducción: ¿Qué es esta plataforma?

Este documento describe cómo funcionará el sitio web oficial (`https://olimpiadas.sitelocuento.com`) del concurso anual de cuentos cortos **Olimpíadas Literarias de SiTeLoCuento**, organizado por nuestro club de escritura **SiTeLoCuento**. Su objetivo es que todo el equipo organizador conozca de principio a fin qué verán los participantes, cómo actuará el jurado y qué herramientas tendremos los organizadores para gestionar el concurso de forma cómoda, transparente y automatizada.

### Principios generales del sitio web
* **100% en español y adaptable a cualquier pantalla:** Se podrá usar cómodamente desde computadoras, tablets o teléfonos móviles.
* **Un sitio para todos los años:** Los escritores crean su cuenta personal una sola vez en el sitio web. Cada año abriremos una nueva edición (por ejemplo, *Olimpíadas Literarias de SiTeLoCuento 2026*, *Olimpíadas Literarias de SiTeLoCuento 2027*) y los usuarios que ya tienen cuenta solo tendrán que entrar e inscribirse en la edición de ese año.
* **Hora oficial del concurso:** Todas las fechas y horas del concurso se regirán por la hora de **Caracas, Venezuela**.

---

## 2. ¿Quiénes utilizan la plataforma? (Tipos de Usuarios)

En la plataforma existirán **4 tipos de usuarios**:

1. **Participantes (Escritores):** Son quienes se inscriben cada año, escriben los cuentos según las consignas, eligen y editan su mejor cuento para concursar, y leen y votan por los cuentos de sus compañeros.
2. **Jurado:** Personas invitadas que entran únicamente en la recta final del concurso para leer los mejores cuentos (los 10 más votados por los participantes) y emitir su voto con un peso especial.
3. **Administradores del Concurso (Equipo Organizador):** Pueden proponer y votar ideas de consignas para el concurso, ver estadísticas en tiempo real, leer todos los cuentos enviados, revisar que nadie haya hecho trampa al editar su cuento, e intervenir ante casos especiales (por ejemplo, recibir un cuento tardío si un participante estuvo enfermo o reincorporar a alguien).
4. **Superadministrador (Coordinador General):** Tiene todas las funciones de un Administrador y, además, es quien configura cada edición anual del concurso: define las fechas de cada etapa, elige las reglas (mínimo y máximo de caracteres, cantidad de fallas permitidas), arma la propuesta final de consignas, edita los textos de los correos automáticos y asigna quién es Administrador o Jurado.

> **Nota importante:** Por transparencia, ni el Superadministrador, ni los Administradores, ni los miembros del Jurado pueden participar como escritores en el concurso.

---

## 3. ¿Qué ve cualquier visitante al entrar al sitio web?

Incluso antes de iniciar sesión, cualquier persona que visite la página podrá consultar en el menú principal:
* **Página de Inicio:** Información del concurso actual y botones para *Iniciar Sesión* o *Crear Cuenta*.
* **¿Quiénes somos?:** Página con la historia de las Olimpíadas Literarias de SiTeLoCuento y presentación del club de escritura y el equipo organizador.
* **Bases del Concurso:** Todas las reglas oficiales de la edición actual.
* **Resultados / Ganadores:** Los 3 cuentos ganadores de la última edición finalizada.
* **Ediciones Anteriores:** Un archivo histórico donde se pueden leer todos los cuentos que llegaron al final en cada edición del concurso.

### ¿Qué ve un participante cuando inicia sesión?
Al entrar con su cuenta, el participante verá siempre un panel muy claro con:
1. **El título de la edición actual** (ej. *Olimpíadas Literarias de SiTeLoCuento 2026*).
2. **La línea de tiempo del concurso:** Todas las etapas con sus fechas (las etapas ya terminadas aparecen tachadas, la etapa actual resaltada en **negrita** y las futuras atenuadas).
3. **Su estado personal actual:** Por ejemplo: *Participando*, *Editando cuento a postular*, *Cuento postulado*, *Esperando votaciones*, *Votación enviada* o *Descalificado*.
4. **Acceso a su Perfil:** Donde puede actualizar su nombre, apellido, país, teléfono, correo electrónico, contraseña y subir su foto de perfil.

---

## 4. El Concurso Paso a Paso (Las Etapas)

El concurso avanza automáticamente según el calendario que configure el Superadministrador. A continuación se explica qué ocurre en cada etapa:

---

### Etapa 1: Creación de Cuenta e Inscripciones
1. **Crear cuenta o entrar:** El usuario puede registrarse usando su correo y contraseña (el sistema verifica si el correo ya existe, exige una contraseña segura de al menos 8 caracteres con 3 de 4 tipos de carácter, permite ver/ocultar la contraseña, envía correo de verificación y ofrece *"Olvidé mi contraseña"*), o bien entrar directamente con un clic usando su cuenta de **Google** o **Microsoft** (que precargan automáticamente nombre, apellido y foto de perfil, siempre editables). Al iniciar sesión accede directo a `/concurso`.
2. **Datos obligatorios y cuenta:** Todo participante debe completar su **Nombre, Apellido, País de residencia, Correo electrónico y Número de teléfono** (con código de país autocompletado según el país seleccionado y formato de ejemplo real) y opcionalmente su foto de perfil. Desde **Mi Perfil** también puede **Cerrar sesión** o **Eliminar cuenta** con confirmación de seguridad.
3. **Seguridad de sesión por inactividad:** Mientras el usuario utiliza la página, su sesión se mantiene activa automáticamente. Si deja la pestaña abierta sin usarla durante 25 minutos, aparece un aviso con cuenta regresiva de 5 minutos para elegir entre **Seguir conectado** o **Cerrar sesión** (y si no responde, se cierra sola). Si cierra la pestaña o el navegador, la sesión caduca en 15 minutos por seguridad.
4. **Inscribirse en la edición del año:** Una vez dentro de su cuenta, mientras estén abiertas las inscripciones, el usuario hace clic en **"Inscribirme al concurso"** y acepta las Bases del Concurso. En ese momento recibe un correo de bienvenida confirmando su inscripción.
   * *¿Qué pasa si alguien entra al sitio cuando ya cerraron las inscripciones y no se inscribió?* Podrá ver su perfil personal, pero no tendrá acceso a las pantallas de participación del concurso en curso.

---

### Etapa 2: Envío de Cuentos (Las Consignas)
En esta etapa comienza el verdadero "maratón" de escritura:

1. **Publicación de consignas:** Según los días y horas programados (por ejemplo, lunes, miércoles y viernes a las 9:00 a.m.), aparece en la pantalla principal la **Consigna activa** (que consta de un título, el texto de la consigna y, opcionalmente, una imagen o un video de YouTube/Vimeo).
2. **Escribir el cuento:** El participante hace clic en **"Escribir / Postular"** y accede a una pantalla limpia donde coloca el **Título** y el **Texto de su cuento** (en texto simple, ya sea escribiéndolo ahí mismo o pegándolo).
   * **Contador de caracteres en vivo:** El sistema muestra en todo momento cuántos caracteres lleva escritos (contando espacios). Si el texto tiene menos del mínimo o más del máximo permitido, el botón de enviar se desactiva y le avisa al participante.
   * **Guardado automático de respaldo:** Mientras escribe, el sistema guarda un borrador automático por si se le corta el internet o se cierra la ventana por accidente.
   * **Reloj de última hora:** Cuando falte menos de 1 hora para que cierre la consigna, aparecerá una cuenta regresiva en pantalla.
3. **Edición libre mientras la consigna siga abierta:** Una vez enviado su cuento, mientras no se haya cumplido la hora de cierre de esa consigna, el participante puede volver a entrar y modificar su texto todas las veces que quiera. Solo se guardará la última versión enviada.
4. **Entre una consigna y otra:** Cuando cierra el tiempo de una consigna, el participante ve un mensaje de *"Próxima consigna en..."* con una cuenta regresiva. Durante esta etapa, el participante aún no puede ver los cuentos que envió en las consignas anteriores.
5. **Control de inasistencias ("Fallas"):**
   * No es obligatorio enviar cuento en absolutamente todas las consignas, pero habrá un **máximo de fallas permitidas** (definido por el Superadministrador).
   * Si un participante llega al límite de fallas permitidas (por ejemplo, ya falló 2 veces y el máximo es 2), sigue en competencia pero recibe un correo de alerta: *"Atención, has fallado 2 veces; si fallas de nuevo serás descalificado"*.
   * Si vuelve a fallar una vez más, **queda descalificado automáticamente**, recibe un correo notificándolo y ya no podrá seguir participando ni votar en esa edición.

*(Al terminar la última consigna, habrá un margen mínimo de 48 horas antes de pasar a la siguiente etapa).*

---

### Etapa 3: Selección y Edición del Cuento a Postular
Cuando abre esta etapa, el participante debe elegir **con cuál de todos sus cuentos quiere competir**:

1. **Leer sus cuentos escritos:** Al entrar, ve la lista de todos los cuentos que escribió en la Etapa 2 (ej. *Consigna 1 - Título del cuento*). Puede abrir cada uno para leerlo, ver de nuevo la consigna completa que lo inspiró (incluyendo imagen o video) y pasar cómodamente de un cuento al siguiente con botones de *Anterior* y *Siguiente*.
2. **Elegir UN cuento (decisión definitiva):** Cuando decide cuál es su mejor cuento, lo selecciona. El sistema le pide confirmación avisándole que **esa elección no se puede cambiar**.
3. **Pulir y editar el cuento elegido:** Una vez elegido el cuento, el autor puede editar su título y su texto todas las veces que quiera para corregir ortografía, gramática, quitar o agregar frases (respetando siempre el límite de caracteres).
   * **Control automático para evitar que cambie el cuento por otro distinto:** El sistema compara automáticamente la versión original con la versión editada. Si el participante borra o cambia demasiado el texto (bajando del porcentaje de similitud permitido), el sistema no le permitirá guardarlo y le recordará que solo se permite editar el cuento, no reemplazarlo por uno nuevo.
4. **Botón final de "Postular":** Mientras está editando, un aviso le recuerda que debe hacer clic en **"Postular"** para terminar. Una vez que pulsa **"Postular"** y confirma, su cuento queda enviado definitivamente y ya no puede hacer más cambios.
   * **Importante:** Si termina el plazo de esta etapa y el participante no pulsó **"Postular"**, queda descalificado del concurso.

---

### Etapa 4: Revisión por los Administradores
Antes de que los cuentos pasen a votación, el equipo de Administradores cuenta con un período de revisión:

1. **Mientras tanto, los participantes** ven en su pantalla que los cuentos están siendo revisados por el equipo organizador junto con la cuenta regresiva para el inicio de las votaciones.
2. **Comparación de cambios:** Los Administradores pueden leer todos los cuentos postulados y tienen un botón para **comparar la versión original con la versión editada** (viendo resaltado qué se quitó y qué se agregó).
3. **¿Qué pasa si un Administrador nota que un cuento fue demasiado modificado?**
   * Ese Administrador puede activar una **Alerta de Modificación** sobre ese cuento.
   * Todos los demás Administradores reciben un correo y ven ese cuento al principio de su lista en una bandeja de *"Alertas pendientes de revisión"*, donde cada uno vota si **Valida** o **Rechaza** los cambios.
   * **Si al menos 2 Administradores validan los cambios:** El cuento queda aprobado de inmediato.
   * **Si termina la etapa de revisión y el cuento NO consiguió al menos 2 validaciones:** Se le da una **segunda oportunidad de 24 horas** al participante. El autor recibe un correo automático explicándole que los organizadores solicitan una revisión de su edición, y durante esas 24 horas podrá entrar al sistema a ajustar su cuento y volverlo a postular.
   * Una vez que el participante sube su cuento corregido, los Administradores tienen las siguientes **24 horas** (antes de que abran las votaciones) para revisarlo de nuevo. Si al menos 2 Administradores lo validan, el cuento entra a las votaciones; si no (o si el autor no lo corrigió a tiempo), el cuento queda descalificado.

---

### Etapa 5: Votaciones de los Participantes
En esta etapa, todos los participantes activos se convierten en lectores y jueces de sus compañeros:

1. **Lectura 100% anónima y en orden aleatorio:**
   * Cada participante ve la lista de todos los cuentos postulados mostrando únicamente el **Número de consigna** y el **Título del cuento** (el nombre del autor está oculto para que nadie vote por amistad).
   * Para que los primeros cuentos de la lista no tengan ventaja, **el sistema ordena la lista al azar para cada participante** (pero manteniendo siempre ese mismo orden para ese participante cada vez que entre).
   * El participante puede ver su propio cuento en la lista, pero **no puede seleccionarlo para votar por sí mismo**.
2. **Marcar como "Leído" y "Preseleccionar" favoritos:**
   * Como habrá muchos cuentos para leer a lo largo de varios días, dentro de cada cuento el participante tiene un botón para marcarlo como **"Leído"** (así lleva el control de cuáles ya leyó) y otro botón para **"Preseleccionarlo"** entre sus favoritos.
   * Puede preseleccionar todos los cuentos que le gusten.
3. **Votar el Top 3:**
   * Cuando el participante haya preseleccionado **al menos 3 cuentos**, se activa el botón **"Votar"** en su pantalla principal.
   * Al entrar a votar, ve únicamente los cuentos que preseleccionó y, de forma muy visual y sencilla (haciendo clic o arrastrando, sin tener que escribir nada), elige cuál pone en **1er lugar (3 puntos)**, **2do lugar (2 puntos)** y **3er lugar (1 punto)**.
   * Tras confirmar su decisión en una pantalla de seguridad, **el voto queda enviado y es definitivo**.
4. **Obligación de votar:** Todo participante activo debe emitir su voto. Si termina la etapa de votaciones y un participante no votó, **queda descalificado** (su propio cuento sale de la competencia, aunque los votos que otros hayan emitido no se alteran).

---

### Etapa 6: Evaluación del Jurado y Desempates
Una vez cerrada la votación de los participantes, entra en acción el **Jurado** (que siempre estará conformado por un **número impar** de miembros):

1. **¿Qué cuentos lee el Jurado? (El Top 10 más votado):**
   * El Jurado no tiene que leer todos los cuentos del concurso, sino únicamente **los 10 cuentos con mayor puntaje de los participantes**.
   * **Regla justa en caso de empates en el corte:** Si en alguno de los 10 primeros puestos hay cuentos empatados en puntos, pasan todos los empatados hasta superar los 10 cuentos. *(Por ejemplo: si entre el 1er y el 5to puesto ya suman 13 cuentos por culpa de varios empates, el jurado leerá esos 13 cuentos y ya no verá los del 6to puesto).*
   * El Jurado lee los cuentos **de forma totalmente anónima** y **nunca ve cuántos votos o puntos recibió cada cuento por parte de los participantes**, para que su opinión sea completamente independiente.
2. **¿Cómo vota el Jurado y cuánto valen sus puntos?**
   * El Jurado utiliza exactamente el mismo sistema cómodo que los participantes: marca cuentos como leídos, preselecciona sus favoritos y elige su **1er, 2do y 3er lugar**.
   * **Peso automático del Jurado:** Los votos del jurado tienen un peso mayor que se ajusta automáticamente según cuántos participantes llegaron a la etapa de votación (por ejemplo: con menos de 30 participantes, cada jurado reparte **15, 10 y 5 puntos**; si hay entre 30 y 60 participantes, reparte **30, 20 y 10 puntos**, y así sucesivamente).
   * Los puntos del Jurado **se suman** a los puntos que ya tenían los cuentos por parte de los participantes.
3. **¿Qué pasa si un miembro del Jurado se retrasa en votar?**
   * Si llega la hora de cierre y falta algún miembro del jurado por votar, el sistema **pone en pausa el cierre** y envía un aviso inmediato a los Administradores para que puedan contactarlo. El concurso no avanza hasta que todos los jurados hayan votado.
4. **Etapa especial de Desempate (solo si hace falta):**
   * Si al sumar los puntos de Participantes + Jurado ocurre un empate exacto en el 1er, 2do o 3er lugar, el sistema abre automáticamente una **Ronda Rápida de Desempate** exclusiva para el Jurado.
   * En esa pantalla, el Jurado verá únicamente los cuentos que quedaron empatados y elegirá su preferido. Como el número de jurados es impar, el empate se resuelve automáticamente en cuanto todos los jurados emiten su elección.

---

### Etapa 7: Anuncio de Ganadores
Esta última etapa **no se dispara sola**, sino que la activa un Administrador o el Superadministrador con un botón cuando verifica que la votación del jurado terminó sin empates. Al activarla ocurre todo esto al mismo tiempo:

1. **Se publica la página de "Resultados / Ganadores":**
   * Muestra a los ganadores del **1er, 2do y 3er lugar**, con la **foto del autor**, su **nombre completo** y el **título de su cuento** (al hacer clic en el título se puede leer el cuento completo y la consigna que lo inspiró).
2. **Se publica la página con todos los "Cuentos Participantes" de la edición:**
   * Muestra todos los cuentos que llegaron al final del concurso, ordenados por número de consigna y orden en que fueron enviados.
   * Todos llevan ahora visible el **nombre de su autor**, y los 3 cuentos ganadores lucen una insignia (*badge*) de **1er, 2do o 3er lugar** al lado de su título.
   * **Cuidado hacia los participantes:** Los puntajes obtenidos y las posiciones del 4to lugar hacia abajo **nunca se hacen públicos ni se muestran a los participantes ni al jurado** (solo los conocen los Administradores y el Superadministrador).
3. **Correo general de anuncio:**
   * Todos los inscritos en el concurso (incluyendo quienes hayan quedado eliminados en etapas previas), el jurado y los organizadores reciben un correo electrónico anunciando los ganadores con el enlace directo a la página de resultados.

---

## 5. Herramientas Exclusivas para el Equipo Organizador (Administradores y Superadministrador)

Para facilitar el trabajo antes y durante el concurso, los Administradores contarán con un panel privado con las siguientes funciones:

### A. Banco Colaborativo de Consignas (Disponible todo el año)
* **Proponer consignas:** En cualquier momento del año, cualquier Administrador puede subir ideas de futuras consignas bien redactadas (con título, texto e imagen o video opcional).
* **Votar con 👍 / 👎 y comentar:** Los demás Administradores pueden leer las consignas propuestas por sus compañeros, dejar comentarios con sugerencias y votar con un pulgar arriba (👍) o abajo (👎). Los votos son **100% anónimos**, pero todos ven el total de votos positivos y negativos que acumula cada consigna. *(Si el autor edita su consigna propuesta, los votos se reinician a cero para que se evalúe la nueva versión).*
* **Armado y validación de las consignas de la edición:**
  1. Antes de iniciar el concurso, el **Superadministrador** elige las mejores consignas del banco para armar el paquete oficial de la edición (mientras están seleccionadas salen del banco de disponibles, pero si las quita vuelven al banco).
  2. El Superadministrador envía ese paquete de consignas a validación y todos los Administradores reciben un correo para entrar a aprobarlo. Si la mayoría aprueba, queda validado (aunque el Superadministrador siempre conserva la facultad de ajustar o cambiar una consigna en caso de necesidad, incluso con el concurso empezado).

### B. Panel de Estadísticas en Tiempo Real
Durante todo el concurso, los Administradores podrán ver en vivo cómo avanza la edición:
* Cantidad total de inscritos, participantes activos y porcentaje de descalificados (desglosado por motivo: por faltar a consignas, por no postular, por no votar, etc.).
* Cantidad de cuentos recibidos en cada consigna y cuántos participantes están al límite de fallas.
* Avance de cuántos participantes y jurados ya han emitido su voto.
* Al terminar la votación de participantes: ver cuántos votos recibió cada cuento y cuáles pasan al Top 10 del jurado.
* Al terminar la votación del jurado: ver la tabla completa de resultados y puntajes finales de todos los cuentos.

### C. Intervenciones ante Casos Especiales y Registro de Acciones (*Log*)
Sabemos que en todo concurso pueden surgir imprevistos humanos. Por eso, los Administradores podrán:
1. **Cargar o editar tardíamente el cuento de un participante:** Si un concursante tuvo una emergencia justificada (por ejemplo, estuvo enfermo y no pudo subir su cuento a tiempo) y lo envía al equipo organizador, un Administrador puede cargarlo en el sistema. Si el participante había quedado descalificado por faltar a esa consigna, **el sistema lo reactiva automáticamente** al subirle el cuento y le avisa por correo.
2. **Reincorporar a un participante descalificado o descalificar manualmente a un participante activo:**
   * Si se descalifica manualmente a alguien, el participante recibe un correo informándole que el equipo organizador se pondrá en contacto con él para explicarle los motivos, y todos los Administradores reciben un aviso inmediato.
3. **Transparencia total (Historial de Acciones):** Cada vez que un Administrador realiza una intervención (descalificar, reincorporar o subir un cuento tardío), el sistema le pide obligatoriamente que escriba una **justificación**. Todo queda guardado en un **Historial de Acciones** visible para todos los Administradores (quién lo hizo, cuándo y por qué).

---

## 6. Resumen de Correos Automáticos que Enviará la Plataforma

Para que ningún participante ni jurado se pierda una etapa por olvido, la plataforma enviará correos automáticos en cada momento clave *(todos estos textos y asuntos podrán ser editados libremente por el Superadministrador)*:

* **Al crear cuenta e inscribirse:** Correo de bienvenida/verificación de cuenta y correo de confirmación de inscripción al concurso.
* **Etapa de envío de cuentos:**
  * Recordatorio **1 día antes** de que empiece la primera consigna.
  * Aviso cada vez que **se publica una nueva consigna**.
  * Recordatorio urgente cuando **falta 1 hora** para cerrar una consigna y el participante aún no ha enviado su cuento.
  * Aviso de **advertencia** cuando el participante alcanza el máximo de fallas permitidas (*"Si fallas una vez más, quedarás descalificado"*).
* **Etapa de selección y postulación:**
  * Recordatorio **1 día antes** de que comience la etapa de postulación/edición.
  * Recordatorio urgente cuando **falta 1 hora** para cerrar la postulación y aún no ha postulado su cuento.
  * Confirmación apenas **postula su cuento**.
  * *(En caso de exceso de cambios en la edición):* Aviso al participante de que dispone de **24 horas** para corregir la edición de su cuento.
* **Etapa de votaciones y jurado:**
  * Aviso de **inicio de votaciones** (para participantes y, en su etapa, para el jurado).
  * Recordatorio urgente cuando **falta 1 hora** para cerrar la votación y aún no ha votado.
  * Confirmación de **voto recibido**.
* **Avisos de estado y cierre:**
  * Correo de **descalificación** (cuando un participante supera las fallas permitidas, no postula o no vota) o correo de **reactivación** (si es reincorporado por los organizadores).
  * Correo final de **Anuncio de Ganadores** para todos los participantes, jurados y organizadores con el enlace directo para conocer y leer los cuentos ganadores.
