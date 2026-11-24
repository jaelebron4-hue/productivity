// Petit point de liaison pour éviter les imports circulaires entre l'app et les vues.
export const bus = {
  /** Redessine la vue courante (remplacé par app.js). */
  render: () => {},
};
