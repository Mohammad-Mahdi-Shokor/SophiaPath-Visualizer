import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';

export const UmlDiagram = ({ data, compact = false }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!data) return null;

  const title = (data.title || '').toString();
  const isAbstract = data.abstract === true || data.isAbstract === true;
  const rawAttributes = data.attributes || data.Attributes || [];
  const rawMethods = data.methods || data.Methods || [];

  const attributes = Array.isArray(rawAttributes) ? rawAttributes : [];
  const methods = Array.isArray(rawMethods) ? rawMethods : [];

  const getVisibilitySymbol = (visibility) => {
    const vis = (visibility || '').toString().toLowerCase();
    if (vis === 'public') return '+';
    if (vis === 'protected') return '#';
    return '-';
  };

  const renderAttributeLine = (attr, idx) => {
    const name = attr.name || '';
    const type = attr.type || '';
    const sym = getVisibilitySymbol(attr.visibility);
    const isStatic = attr.static === true || attr.isStatic === true;

    return (
      <Typography
        key={idx}
        sx={{
          fontFamily: '"Roboto Mono", monospace',
          fontSize: '0.8rem',
          color: theme.palette.text.primary,
          textDecoration: isStatic ? 'underline' : 'none',
          lineHeight: 1.5,
          textAlign: 'left'
        }}
      >
        {`${sym} ${name}${type ? ` : ${type}` : ''}`}
      </Typography>
    );
  };

  const renderMethodLine = (method, idx) => {
    const name = method.name || '';
    const returnType = method.type || method.returnType || '';
    const rawParams = method.parameter || method.parameters || [];
    const params = Array.isArray(rawParams) ? rawParams : [];
    const isStatic = method.static === true || method.isStatic === true;
    const isAbstractMethod = method.abstract === true || method.isAbstract === true;
    const sym = getVisibilitySymbol(method.visibility || 'public');

    const paramStrings = params.map(p => {
      const pType = p.type || '';
      const pName = p.name || '';
      if (pType && pName) return `${pType} ${pName}`;
      return pName || pType;
    });

    const paramStr = paramStrings.join(', ');
    const returnTypeStr = returnType === 'constructor' ? '' : returnType ? ` : ${returnType}` : '';
    const lineText = `${sym} ${name}(${paramStr})${returnTypeStr}`;

    return (
      <Typography
        key={idx}
        sx={{
          fontFamily: '"Roboto Mono", monospace',
          fontSize: '0.8rem',
          color: theme.palette.text.primary,
          textDecoration: isStatic ? 'underline' : 'none',
          fontStyle: isAbstractMethod ? 'italic' : 'normal',
          lineHeight: 1.5,
          textAlign: 'left'
        }}
      >
        {lineText}
      </Typography>
    );
  };

  const diagramBody = (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Box
        sx={{
          padding: '10px 16px',
          borderBottom: attributes.length > 0 || methods.length > 0 ? `1.5px solid ${theme.palette.primary.main}4d` : 'none',
          backgroundColor: isAbstract ? `${theme.palette.primary.main}1a` : `${theme.palette.primary.main}0d`,
          textAlign: 'center'
        }}
      >
        {isAbstract && (
          <Typography
            sx={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: theme.palette.primary.main,
              fontStyle: 'italic',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              mb: 0.5
            }}
          >
            «abstract»
          </Typography>
        )}
        <Typography
          sx={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: isAbstract ? theme.palette.primary.main : theme.palette.text.primary,
            fontStyle: isAbstract ? 'italic' : 'normal',
            fontFamily: '"Outfit", sans-serif'
          }}
        >
          {title}
        </Typography>
      </Box>

      {attributes.length > 0 && (
        <Box
          sx={{
            p: 1,
            borderBottom: methods.length > 0 ? `1.5px solid ${theme.palette.primary.main}4d` : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {attributes.map(renderAttributeLine)}
        </Box>
      )}

      {methods.length > 0 && (
        <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {methods.map(renderMethodLine)}
        </Box>
      )}
    </Box>
  );

  if (compact) {
    return (
      <Box
        sx={{
          width: '100%',
          maxWidth: 360,
          mx: 'auto',
          borderRadius: 2,
          border: `2px solid ${theme.palette.primary.main}66`,
          backgroundColor: theme.palette.background.paper,
          overflow: 'hidden',
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.08)'
        }}
      >
        {diagramBody}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 2,
          border: `2px solid ${theme.palette.primary.main}80`,
          backgroundColor: theme.palette.background.paper,
          overflow: 'hidden',
          boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.5)' : '0 8px 20px rgba(0,0,0,0.1)'
        }}
      >
        {diagramBody}
      </Box>
    </Box>
  );
};
