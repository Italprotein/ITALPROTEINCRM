import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: ['assets/**', '.next/**', 'node_modules/**', 'lib/generated/**'],
  },
  ...nextVitals,
  {
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default config;
