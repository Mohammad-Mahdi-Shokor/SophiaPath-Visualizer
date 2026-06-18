import React from 'react';
import { Box, Typography, Paper, useTheme } from '@mui/material';

export const UmlDiagram = ({ data, compact = false }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!data) return null;

  const title = (data.title || '').toString();
  const isAbstract = data.abstract === true || data.isAbstract === true;
  const rawAttributes = data.attributes || [];
  const rawMethods = data.methods || [];

  const attributes = Array.isArray(rawAttributes) ? rawAttributes : [];
  const methods = Array.isArray(rawMethods) ? rawMethods : [];

  const getVisibilitySymbol = (visibility) => {
    const vis = (visibility || '').toString().toLowerCase();
    if (vis === 'public') return '+';
    if (vis === 'protected') return '#';
    return '-'; // private / default
  };

  const renderAttributeLine = (attr, idx) => {
    const name = attr.name || '';
    const type = attr.type || '';
    const sym = getVisibilitySymbol(attr.visibility);
    const isStatic = attr.static === true || attr.isStatic === true;

    return (
      <Typography
        key={idx}
        style={{
          fontFamily: '"Roboto Mono", monospace',
          fontSize: '0.8rem',
          color: theme.palette.text.primary,
          textDecoration: isStatic ? 'underline' : 'none',
          lineHeight: 1.5,
          textAlign: 'left'
        }}
      >
        {`${sym} ${name} : ${type}`}
      </Typography>
    );
  };

  const renderMethodLine = (method, idx) => {
    const name = method.name || '';
    const returnType = method.returnType || '';
    const rawParams = method.parameters || [];
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
    const returnTypeStr = returnType === 'constructor' ? '' : ` : ${returnType}`;
    const lineText = `${sym} ${name}(${paramStr})${returnTypeStr}`;

    return (
      <Typography
        key={idx}
        style={{
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
    <Box style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Class Name Section */}
      <Box
        style={{
          padding: '10px 16px',
          borderBottom: attributes.length > 0 || methods.length > 0 ? `1.5px solid ${theme.palette.primary.main}4d` : 'none',
          backgroundColor: isAbstract ? `${theme.palette.primary.main}1a` : `${theme.palette.primary.main}0d`,
          textAlign: 'center'
        }}
      >
        {isAbstract && (
          <Typography
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: theme.palette.primary.main,
              fontStyle: 'italic',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '2px'
            }}
          >
            «abstract»
          </Typography>
        )}
        <Typography
          style={{
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

      {/* Attributes Section */}
      {attributes.length > 0 && (
        <Box
          style={{
            padding: '8px 16px',
            borderBottom: methods.length > 0 ? `1.5px solid ${theme.palette.primary.main}4d` : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {attributes.map((attr, idx) => renderAttributeLine(attr, idx))}
        </Box>
      )}

      {/* Methods Section */}
      {methods.length > 0 && (
        <Box
          style={{
            padding: '8px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {methods.map((method, idx) => renderMethodLine(method, idx))}
        </Box>
      )}
    </Box>
  );

  if (compact) {
    return (
      <Box
        style={{
          width: '100%',
          maxWidth: '360px',
          margin: '0 auto',
          borderRadius: '8px',
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
    <Box style={{ display: 'flex', justifyContent: 'center', margin: '0' }}>
      <Box
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: '10px',
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
