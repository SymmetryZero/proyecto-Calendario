# Manual de Usuario - Servimeci App

## 1. Presentación

Servimeci App es una plataforma para registrar usuarios, crear tareas, asignar personal, subir evidencias, editar croquis y dar seguimiento al trabajo diario del equipo.

Este manual explica, paso a paso, cómo usar el sistema desde el registro de usuarios hasta las funciones principales disponibles para administradores, gerentes y empleados.

## 2. Roles del sistema

### Administrador
Tiene control total del sistema. Puede ver toda la información, registrar, editar y eliminar usuarios, crear y eliminar tareas, administrar áreas y zonas de trabajo, y revisar estadísticas y evidencias globales.

### Gerente
Supervisa el trabajo de su equipo. Puede crear, administrar y eliminar tareas de su zona/área, asignar personal, revisar avances, consultar y cargar evidencias.

### Empleado
Ejecuta el trabajo operativo. Puede ver las tareas asignadas o disponibles según sus áreas permitidas, reclamar tareas disponibles, cambiar su estado y registrar evidencias. **Importante:** Los empleados no tienen permitido eliminar tareas del sistema.

## 3. Acceso al sistema

1. Abre la aplicación desde el navegador o desde el acceso directo si ya está instalada como PWA.
2. Inicia sesión con tu cuenta autorizada.
3. Una vez dentro, verás el tablero principal con las tareas, filtros y accesos a los módulos disponibles según tu rol.

## 4. Registro y edición de usuarios

Este módulo se usa principalmente por administradores.

### 4.1 Registrar un usuario

1. Entra al módulo de usuarios.
2. Pulsa el botón Registrar Usuario.
3. Completa los campos:
   - Nombre completo
   - Fecha de nacimiento
   - Rol en el sistema
   - Puesto o cargo
   - Zonas de trabajo
   - Áreas de trabajo
   - Fotografía, si es necesario
4. Guarda los cambios.

### 4.2 Editar un usuario

1. Busca al usuario en la lista.
2. Presiona Editar.
3. Actualiza los datos necesarios.
4. Guarda los cambios.

### 4.3 Zonas de trabajo

Las zonas ayudan a organizar el personal y las tareas. Puedes agregar una o varias zonas por usuario.

La primera zona se toma como principal.

### 4.4 Áreas de trabajo

Las áreas controlan qué tareas puede ver o tomar cada usuario.

Importante:
Las tareas del área General solo pueden crearlas administradores o gerentes.

## 5. Crear tareas

### 5.1 Abrir el formulario

1. Pulsa Nueva tarea.
2. Se abrirá el formulario de registro.

### 5.2 Completar la tarea

Llena los campos principales:

- Título
- Descripción
- Ubicación
- Fecha de vencimiento
- Prioridad
- Área
- Estado
- Asignado a
- Duración estimada

### 5.3 Ubicación

Al escribir una ubicación, el sistema sugiere valores ya usados anteriormente.

Si la ubicación ya existe, puedes seleccionarla de la lista.
Si no existe, puedes escribir una nueva.

### 5.4 Área General

El área General está reservada para administradores y gerentes.
Los empleados no pueden crear tareas en esa área.

### 5.5 Guardar la tarea

1. Revisa los datos.
2. Presiona Crear tarea.
3. La tarea aparecerá en el tablero y en los módulos relacionados.

## 6. Revisar y administrar tareas

### 6.1 Ver tareas

Desde el tablero puedes ver las tareas por estado:

- Por hacer
- En progreso
- En revisión
- Hechas

### 6.2 Tomar una tarea

Si una tarea está disponible en tus áreas y no tiene personal asignado, puedes reclamarla:

1. Abre la tarea.
2. Presiona **Tomar tarea**.
3. La tarea quedará asignada a ti.

*Nota:* Si la tarea ya está asignada a ti, el botón **Tomar tarea** se ocultará automáticamente para evitar redundancias.

### 6.3 Cambiar estado

Según tu rol, podrás mover la tarea entre los estados disponibles.
Esto sirve para indicar si la tarea va avanzando o ya está terminada.

### 6.4 Escalar una tarea

Si una tarea necesita revisión o apoyo de otra área:

1. Abre la tarea.
2. Selecciona Escalar tarea.
3. Escoge el área de destino.
4. Si hace falta, asigna una persona específica.
5. Agrega una explicación.
6. Confirma.

### 6.5 Eliminar una tarea

La eliminación de tareas está estrictamente reservada para administradores y gerentes:

1. En la tarjeta de la tarea en el tablero, presiona el icono de la papelera (**Eliminar**).
2. Se abrirá una ventana de confirmación.
3. Confirma la acción. La tarea y sus elementos asociados se eliminarán permanentemente del tablero.

*Nota:* Si eres Empleado, el botón de eliminar no aparecerá en tus tarjetas para garantizar la integridad de los flujos de trabajo.

## 7. Evidencias

Las evidencias sirven para guardar pruebas del trabajo realizado.

### 7.1 Subir evidencia desde una tarea

1. Abre la tarea.
2. Selecciona Agregar evidencia.
3. Elige una imagen, video o audio.
4. Escribe el nombre de la evidencia.
5. Agrega una descripción si es necesario.
6. Guarda la evidencia.

### 7.2 Ver evidencias

Las evidencias se pueden consultar dentro de la tarea y también en el módulo de evidencias.

### 7.3 Editar o eliminar evidencias

Si tienes permisos, podrás:

- Cambiar el nombre
- Cambiar la descripción
- Eliminar el archivo

## 8. Plano o dibujo técnico

La aplicación incluye una herramienta de dibujo para croquis técnicos.

### 8.1 Guardar un croquis

1. Abre el módulo de dibujo.
2. Usa las herramientas para trazar líneas, figuras o texto.
3. Guarda el croquis cuando termines.

### 8.2 Relación con tareas

El croquis puede vincularse como evidencia para dejar registro visual del trabajo.

## 9. Módulo de evidencias

Aquí puedes revisar todo el material cargado al sistema.

### Funciones principales

- Buscar evidencias
- Ver imágenes, videos o audios
- Revisar evidencias vinculadas a tareas
- Cargar más archivos, según permiso

## 10. Dashboard

El tablero principal es el centro de operación.

### Qué permite

- Ver tareas activas
- Revisar estados
- Buscar por nombre, descripción, zona o evidencia
- Acceder rápidamente a nuevas tareas
- Consultar información resumida del trabajo diario

## 11. Filtros

La aplicación permite filtrar la información para encontrar más rápido lo que necesitas.

Puedes filtrar por:

- Zona
- Área
- Estado
- Texto de búsqueda

## 12. Estadísticas

El módulo de estadísticas muestra información resumida del sistema.

Sirve para revisar:

- Cantidad de tareas
- Avances por zona o área
- Evidencias registradas
- Actividad general

## 13. Centro de Alertas y Notificaciones

El Centro de Alertas es una barra superior interactiva (con un ícono de campana) que notifica en tiempo real sobre los movimientos y eventos importantes de las tareas.

### 13.1 Distribución inteligente de alertas por rol

Para evitar la sobrecarga de notificaciones irrelevantes, el sistema filtra dinámicamente las alertas según el rol del usuario:

- **Administradores**: Reciben absolutamente todas las alertas generadas en la aplicación (creaciones, comentarios, evidencias, movimientos y borrados de tareas).
- **Gerentes**: Reciben notificaciones de creaciones de tareas, comentarios, evidencias subidas y tareas eliminadas, siempre y cuando la tarea pertenezca a su zona y área de trabajo supervisada.
- **Empleados**: Reciben alertas únicamente de los cambios de estado, comentarios, evidencias y borrados correspondientes a las tareas en las que están **directamente involucrados** (ya sea porque las crearon, están asignadas a ellos, fueron parte del historial de comentarios/evidencias o participaron en su escalación).

### 13.2 Funciones de Alertas

- **Burbuja de conteo móvil y de escritorio**: Muestra en tiempo real la cantidad de alertas no leídas.
- **Navegación al detalle**: Al hacer clic en cualquier alerta vinculada a una tarea, el sistema marcará la alerta como leída, cerrará el Centro de Alertas y abrirá automáticamente el Modal de Detalle e Historial de la Tarea.
- **Limpieza local**: Puedes presionar el botón **Limpiar Todo** al final del panel de alertas. Esto marcará todas tus notificaciones como leídas localmente, ocultándolas de tu Centro de Alertas de forma instantánea sin borrarlas del servidor de Supabase, manteniendo así el historial íntegro.

## 14. Configuración

Desde configuración puedes revisar opciones relacionadas con la sesión, visibilidad y comportamiento general del sistema.

## 15. Uso en celular

La aplicación está pensada para funcionar en móvil.

Recomendaciones:

- Desliza para ver formularios completos
- Usa el botón de cerrar para salir de un modal
- Revisa los campos antes de guardar
- Si un campo tiene sugerencias, aprovecha la lista para escribir más rápido

## 16. Recomendaciones de uso

- Mantén actualizados los datos del usuario.
- Usa nombres claros para tareas y evidencias.
- Registra ubicación y zona siempre que sea posible.
- Carga evidencias al terminar el trabajo.
- Si una tarea requiere otro departamento, escálala en lugar de duplicarla.

## 17. Problemas frecuentes

### No veo todas las tareas

Puede deberse a tu rol, zona o áreas asignadas. Los administradores ven todo de forma global, mientras que los gerentes y empleados están limitados a las áreas y zonas especificadas en su perfil.

### No puedo crear una tarea en General

Solo administradores y gerentes pueden usar esa área.

### No puedo subir una evidencia

Revisa si tienes permiso sobre esa tarea y si el archivo es válido.

### El formulario no se ve completo en el móvil

Desliza dentro del modal para llegar a los botones finales.

### No veo el botón para eliminar una tarea

El botón de eliminación (icono de papelera) está estrictamente oculto para empleados. Si necesitas eliminar una tarea, debes solicitarlo a un gerente o administrador.

### No veo el botón de "Tomar tarea"

Si la tarea ya está asignada a ti (eres el técnico responsable de ella), el botón de tomar tarea no se mostrará para evitar redundancias.

## 18. Cierre

Servimeci App centraliza usuarios, tareas, evidencias y seguimiento operativo en un solo sistema.
Para un mejor uso, mantén la información completa y ordenada en cada registro.
