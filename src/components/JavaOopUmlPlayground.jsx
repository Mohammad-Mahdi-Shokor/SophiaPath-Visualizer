import React, { useState, useEffect, useRef, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import html2canvas from 'html2canvas';
import { simulateCodeExecution, executeCodeAsync } from './CppPlaygroundDialog';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  TextField,
  Box,
  Typography,
  Paper,
  Grid,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  useTheme,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Code as CodeIcon,
  Loop as SyncIcon,
  PlayArrow as PlayIcon,
  Terminal as TerminalIcon,
  HelpOutline as HelpIcon,
  Remove as RemoveIcon,
  Visibility as PreviewIcon
} from '@mui/icons-material';

// Preloaded OOP Examples
const EXAMPLES = [
  {
    name: 'Bank Account System (Inheritance Example)',
    code: `public class BankAccount {
    protected String accountNumber;
    protected double balance;

    public BankAccount(String accNum) {
        accountNumber = accNum;
        balance = 0.0;
    }

    public void deposit(double amount) {
        balance = balance + amount;
    }

    public void withdraw(double amount) {
        balance = balance - amount;
    }

    public double getBalance() {
        return balance;
    }
}

public class SavingsAccount extends BankAccount {
    private double interestRate;

    public SavingsAccount(String accNum, double rate) {
        super(accNum);
        interestRate = rate;
    }

    public void addInterest() {
        double interest = balance * interestRate;
        balance = balance + interest;
    }
}`,
    mainCode: `public class Runner {
    public static void main(String[] args) {
        SavingsAccount acc = new SavingsAccount("SA-100", 0.05);
        acc.deposit(200.0);
        acc.addInterest();
        System.out.println("Savings Account Balance: $" + acc.getBalance());
    }
}`
  },
  {
    name: 'Geometric Shapes (Abstraction Example)',
    code: `public abstract class Shape {
    protected String color;

    public Shape(String colorName) {
        color = colorName;
    }

    public abstract double getArea();

    public void displayColor() {
        System.out.println("Color: " + color);
    }
}

public class Circle extends Shape {
    private double radius;

    public Circle(String colorName, double r) {
        super(colorName);
        radius = r;
    }

    public double getArea() {
        return 3.14159 * radius * radius;
    }
}`,
    mainCode: `public class Runner {
    public static void main(String[] args) {
        Circle c = new Circle("Crimson Red", 5.0);
        c.displayColor();
        System.out.println("Circle Area: " + c.getArea());
    }
}`
  },
  {
    name: 'Car Engine Assembly (Composition/Has-A Example)',
    code: `public class Engine {
    private int horsepower;

    public Engine(int hp) {
        horsepower = hp;
    }

    public void start() {
        System.out.println("Engine started with " + horsepower + " HP!");
    }
}

public class Car {
    private String model;
    private Engine engine;

    public Car(String modelName) {
        model = modelName;
        engine = new Engine(250);
    }

    public void drive() {
        engine.start();
        System.out.println(model + " is driving down the highway!");
    }
}`,
    mainCode: `public class Runner {
    public static void main(String[] args) {
        Car myCar = new Car("Mustang GT");
        myCar.drive();
    }
}`
  }
];

const umlClassesToJava = (classes) => {
  let code = "";
  classes.forEach(uml => {
    if (uml.abstract) {
      code += "public abstract class " + uml.title;
    } else {
      code += "public class " + uml.title;
    }
    
    if (uml.extends) {
      code += " extends " + uml.extends;
    }
    
    code += " {\n";

    // Attributes
    uml.attributes.forEach(attr => {
      const vis = attr.visibility === "public" ? "public" : (attr.visibility === "protected" ? "protected" : "private");
      const isStatic = attr.isStatic ? "static " : "";
      code += `    ${vis} ${isStatic}${attr.type} ${attr.name};\n`;
    });

    if (uml.attributes.length > 0) code += "\n";

    // Methods
    uml.methods.forEach(m => {
      const vis = m.visibility === "public" ? "public" : (m.visibility === "protected" ? "protected" : "private");
      const isStatic = m.isStatic ? "static " : "";
      const isAbstract = m.isAbstract;
      
      const paramsStr = (m.parameters || []).map(p => `${p.type} ${p.name}`).join(", ");
      
      if (isAbstract) {
        code += `    ${vis} abstract ${isStatic}${m.returnType} ${m.name}(${paramsStr});\n`;
      } else {
        const retType = m.returnType === "constructor" ? "" : m.returnType + " ";
        
        const bodyText = m.body !== undefined ? m.body : (
          m.returnType !== "void" && m.returnType !== "constructor"
            ? `\n        return ${m.returnType === "int" || m.returnType === "double" || m.returnType === "float" ? "0.0" : (m.returnType === "boolean" ? "false" : "null")};\n    `
            : '\n    '
        );
        
        code += `    ${vis} ${isStatic}${retType}${m.name}(${paramsStr}) {${bodyText}}\n`;
      }
    });

    code += "}\n\n";
  });
  
  return code.trim() + "\n";
};

const parseParams = (rawParams) => {
  return rawParams.split(",").map(p => p.trim()).filter(p => p.length > 0).map(p => {
    const parts = p.split(/\s+/);
    if (parts.length >= 2) {
      return { type: parts[0], name: parts[1] };
    }
    return { type: "Object", name: p };
  });
};

const parseMethodSignature = (sig, uml) => {
  const methodRegex = /^(public|private|protected)?\s*(static\s+)?(abstract\s+)?([A-Za-z0-9_<>[\]]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/;
  let match = methodRegex.exec(sig);
  
  if (match) {
    const visibility = match[1] || "public";
    const isStatic = !!match[2];
    const isAbstract = !!match[3];
    const returnType = match[4];
    const name = match[5];
    const rawParams = match[6] || "";

    const parameters = parseParams(rawParams);

    uml.methods.push({
      name,
      returnType: name === uml.title ? "constructor" : returnType,
      visibility,
      isStatic,
      isAbstract,
      parameters
    });
  } else {
    const constrRegex = /^(public|private|protected)?\s*([A-Za-z0-9_]+)\s*\(([^)]*)\)/;
    match = constrRegex.exec(sig);
    if (match) {
      const visibility = match[1] || "public";
      const name = match[2];
      const rawParams = match[3] || "";
      
      if (name === uml.title) {
        const parameters = parseParams(rawParams);
        uml.methods.push({
          name,
          returnType: "constructor",
          visibility,
          isStatic: false,
          isAbstract: false,
          parameters
        });
      }
    }
  }
};

const parseAttributeSignature = (sig, uml) => {
  const attrRegex = /^(public|private|protected)?\s*(static\s+)?([A-Za-z0-9_<>[\]]+)\s+([A-Za-z0-9_]+)\s*(?:=.*)?$/;
  const match = attrRegex.exec(sig);
  if (match) {
    const visibility = match[1] || "private";
    const isStatic = !!match[2];
    const type = match[3];
    const name = match[4];

    uml.attributes.push({
      name,
      type,
      visibility,
      isStatic
    });
  }
};

const calculateCardWidth = (umlClass) => {
  let maxWidth = 280; // Minimum default width
  
  // Calculate width from attributes
  (umlClass.attributes || []).forEach(attr => {
    const typeLen = attr.type ? attr.type.length : 0;
    const nameLen = attr.name ? attr.name.length : 0;
    const typeSelectWidth = Math.max(70, typeLen * 8 + 24);
    const nameInputWidth = Math.max(60, nameLen * 8 + 12);
    // Visibility select (32) + typeSelectWidth + nameInputWidth + Static checkbox (36) + Delete button (24) + gaps/padding (36)
    const rowWidth = 32 + typeSelectWidth + nameInputWidth + 36 + 24 + 36;
    if (rowWidth > maxWidth) {
      maxWidth = rowWidth;
    }
  });

  // Calculate width from methods
  (umlClass.methods || []).forEach(method => {
    const typeLen = method.returnType ? method.returnType.length : 0;
    const nameLen = method.name ? method.name.length : 0;
    const typeSelectWidth = Math.max(70, typeLen * 8 + 24);
    const nameInputWidth = Math.max(60, nameLen * 8 + 12);
    // Visibility select (32) + typeSelectWidth + nameInputWidth + Static & Abstract checkboxes (68) + Delete button (24) + gaps/padding (36)
    const rowWidth = 32 + typeSelectWidth + nameInputWidth + 68 + 24 + 36;
    if (rowWidth > maxWidth) {
      maxWidth = rowWidth;
    }
  });

  // Add safety padding and cap at 600px
  return Math.min(600, maxWidth);
};

const javaToUmlClasses = (code) => {
  let cleanCode = code
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 

  const classes = [];
  const classDeclRegex = /(?:(public|protected|private)\s+)?(?:(abstract)\s+)?class\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?/g;
  let match;
  
  while ((match = classDeclRegex.exec(cleanCode)) !== null) {
    const isAbstract = !!match[2];
    const className = match[3];
    const extendsClass = match[4] || null;
    
    const searchStart = match.index + match[0].length;
    const openBraceIdx = cleanCode.indexOf("{", searchStart);
    if (openBraceIdx === -1) continue;
    
    let depth = 1;
    let closeBraceIdx = -1;
    for (let i = openBraceIdx + 1; i < cleanCode.length; i++) {
      if (cleanCode[i] === '{') depth++;
      else if (cleanCode[i] === '}') {
        depth--;
        if (depth === 0) {
          closeBraceIdx = i;
          break;
        }
      }
    }
    
    if (closeBraceIdx === -1) continue;
    
    const classBody = cleanCode.substring(openBraceIdx + 1, closeBraceIdx);
    
    const uml = {
      title: className,
      abstract: isAbstract,
      extends: extendsClass,
      attributes: [],
      methods: []
    };
    
    let accumulated = "";
    let methodBodyAccumulated = "";
    let bodyDepth = 0;
    let currentMethodIndex = -1;
    
    for (let charIdx = 0; charIdx < classBody.length; charIdx++) {
      const char = classBody[charIdx];
      
      if (char === '{') {
        if (bodyDepth === 0) {
          const sig = accumulated.trim();
          if (sig.length > 0) {
            parseMethodSignature(sig, uml);
            currentMethodIndex = uml.methods.length - 1;
          }
          accumulated = "";
          methodBodyAccumulated = "";
        } else {
          methodBodyAccumulated += char;
        }
        bodyDepth++;
      } else if (char === '}') {
        bodyDepth--;
        if (bodyDepth < 0) {
          break;
        }
        if (bodyDepth === 0) {
          if (currentMethodIndex !== -1 && uml.methods[currentMethodIndex]) {
            uml.methods[currentMethodIndex].body = methodBodyAccumulated;
          }
          accumulated = "";
          methodBodyAccumulated = "";
          currentMethodIndex = -1;
        } else {
          methodBodyAccumulated += char;
        }
      } else if (char === ';') {
        if (bodyDepth === 0) {
          const decl = accumulated.trim();
          if (decl.length > 0) {
            if (decl.includes("(")) {
              parseMethodSignature(decl, uml);
            } else {
              parseAttributeSignature(decl, uml);
            }
          }
          accumulated = "";
        } else {
          methodBodyAccumulated += char;
        }
      } else {
        if (bodyDepth === 0) {
          accumulated += char;
        } else {
          methodBodyAccumulated += char;
        }
      }
    }
    
    classes.push(uml);
  }
  
  return classes;
};

const analyzeRelationships = (classes) => {
  const relations = []; // { source, target, type, fieldName }
  
  classes.forEach(c => {
    // 1. Inheritance
    if (c.extends) {
      relations.push({ source: c.title, target: c.extends, type: 'extends' });
    }
    
    // 2. Attributes (Composition, Aggregation, Association)
    c.attributes.forEach(attr => {
      const targetClass = classes.find(p => p.title === attr.type && p.title !== c.title);
      if (targetClass) {
        // Let's check if it's instantiated in any constructor
        let isInstantiatedInConstructor = false;
        c.methods.forEach(m => {
          if (m.returnType === 'constructor' && m.body) {
            const newRegex = new RegExp(`new\\s+${targetClass.title}\\b`);
            if (newRegex.test(m.body)) {
              isInstantiatedInConstructor = true;
            }
          }
        });
        
        let type = 'aggregation';
        if (isInstantiatedInConstructor) {
          type = 'composition';
        } else if (attr.visibility === 'public' || attr.visibility === 'protected') {
          type = 'association';
        }
        
        relations.push({ source: c.title, target: targetClass.title, type, fieldName: attr.name });
      }
    });
    
    // 3. Methods (Dependency)
    c.methods.forEach(m => {
      // Check parameters
      (m.parameters || []).forEach(p => {
        const targetClass = classes.find(pClass => pClass.title === p.type && pClass.title !== c.title);
        if (targetClass) {
          // Verify we don't already have an attribute-level relation (which is stronger)
          const existing = relations.find(r => r.source === c.title && r.target === targetClass.title && r.type !== 'dependency');
          if (!existing) {
            relations.push({ source: c.title, target: targetClass.title, type: 'dependency', methodName: m.name });
          }
        }
      });
      
      // Check local instantiation inside method body
      if (m.body && m.returnType !== 'constructor') {
        classes.forEach(targetClass => {
          if (targetClass.title !== c.title) {
            const newRegex = new RegExp(`new\\s+${targetClass.title}\\b`);
            if (newRegex.test(m.body)) {
              const existing = relations.find(r => r.source === c.title && r.target === targetClass.title);
              if (!existing) {
                relations.push({ source: c.title, target: targetClass.title, type: 'dependency', methodName: m.name });
              }
            }
          }
        });
      }
    });
  });
  
  return relations;
};

export const JavaOopUmlPlayground = ({ open, onClose, csvExamples = [] }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // Merge hardcoded OOP examples with CSV-derived examples from info.csv
  const ALL_EXAMPLES = useMemo(() => {
    const csvMapped = csvExamples.map(ex => ({
      name: ex.name,
      code: ex.code,
      mainCode: ex.mainCode || `public class Runner {
    public static void main(String[] args) {
        // Add your test code here
    }
}`,
    }));
    return [...EXAMPLES, ...csvMapped];
  }, [csvExamples]);

  const [code, setCode] = useState(ALL_EXAMPLES[0].code);
  const [umlClasses, setUmlClasses] = useState(javaToUmlClasses(ALL_EXAMPLES[0].code));
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);

  const [activeTab, setActiveTab] = useState('uml'); // 'uml' | 'runner'
  const [inputStr, setInputStr] = useState('');
  const [mainCode, setMainCode] = useState(ALL_EXAMPLES[0].mainCode);
  const [terminalOutput, setTerminalOutput] = useState('Terminal ready. Click "RUN JAVA CODE" to execute.');
  const [isRunning, setIsRunning] = useState(false);

  const [isEditorReady, setIsEditorReady] = useState(false);
  const [splitPercent, setSplitPercent] = useState(55);

  // 2D Interactive Canvas States
  const [classPositions, setClassPositions] = useState({});
  const [draggingClass, setDraggingClass] = useState(null);

  const [connectingSource, setConnectingSource] = useState(null);
  const [connectionStart, setConnectionStart] = useState(null);
  const [connectionCurrent, setConnectionCurrent] = useState(null);

  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [newConnectionData, setNewConnectionData] = useState({ source: '', target: '' });
  const [newFieldName, setNewFieldName] = useState('');
  const [newRelationType, setNewRelationType] = useState('extends');

  // Zoom and Preview States
  const [zoomScale, setZoomScale] = useState(1.0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewZoomScale, setPreviewZoomScale] = useState(1.0);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [currentInputVal, setCurrentInputVal] = useState('');

  // Refs (All declared at the top of the component to prevent TDZ/initialization errors in hooks)
  const isDraggingSplitRef = useRef(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const internalUpdateRef = useRef(false);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const umlEditorRef = useRef(null);
  const execEditorRef = useRef(null);
  const runnerEditorRef = useRef(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const canvasContainerRef = useRef(null);
  const inputResolverRef = useRef(null);
  const isPanningPreviewRef = useRef(false);
  const panStartPreviewRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const previewCanvasContainerRef = useRef(null);

  // Pre-fill attribute name for composition relationship
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (newConnectionData.target) {
      const defaultName = newConnectionData.target.charAt(0).toLowerCase() + newConnectionData.target.slice(1);
      setNewFieldName(defaultName);
    }
  }, [newConnectionData.target]);

  // Window listeners for dragging the divider in the resizable split view and canvas panning
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingSplitRef.current) {
        const container = document.getElementById('split-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const offset = e.clientX - rect.left;
          const newPercent = Math.max(25, Math.min(75, (offset / rect.width) * 100));
          setSplitPercent(newPercent);
        }
      } else if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        if (canvasContainerRef.current) {
          canvasContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
          canvasContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
        }
      } else if (isPanningPreviewRef.current) {
        const dx = e.clientX - panStartPreviewRef.current.x;
        const dy = e.clientY - panStartPreviewRef.current.y;
        if (previewCanvasContainerRef.current) {
          previewCanvasContainerRef.current.scrollLeft = panStartPreviewRef.current.scrollLeft - dx;
          previewCanvasContainerRef.current.scrollTop = panStartPreviewRef.current.scrollTop - dy;
        }
      }
    };

    const handleMouseUp = () => {
      if (isDraggingSplitRef.current) {
        isDraggingSplitRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (isPanningRef.current) {
        isPanningRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (isPanningPreviewRef.current) {
        isPanningPreviewRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleCanvasMouseDown = (e) => {
    // Only pan if clicked on the background grid canvas, not inside a class card, port, menu, dialog, or buttons.
    if (
      e.target.closest('.uml-class-card') || 
      e.target.closest('.uml-port') || 
      e.target.closest('button') || 
      e.target.closest('.MuiSelect-select') ||
      e.target.closest('.MuiSelect-root')
    ) {
      return;
    }

    e.preventDefault();
    isPanningRef.current = true;
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: canvasContainerRef.current ? canvasContainerRef.current.scrollLeft : 0,
      scrollTop: canvasContainerRef.current ? canvasContainerRef.current.scrollTop : 0
    };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  };

  const handlePreviewCanvasMouseDown = (e) => {
    if (
      e.target.closest('.uml-class-card') || 
      e.target.closest('button')
    ) {
      return;
    }

    e.preventDefault();
    isPanningPreviewRef.current = true;
    panStartPreviewRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: previewCanvasContainerRef.current ? previewCanvasContainerRef.current.scrollLeft : 0,
      scrollTop: previewCanvasContainerRef.current ? previewCanvasContainerRef.current.scrollTop : 0
    };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  };

  // Non-passive wheel event listeners for smooth Ctrl + Mousewheel zooming
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const step = 0.05;
        setZoomScale(prev => Math.max(0.4, Math.min(2.0, prev + (e.deltaY < 0 ? step : -step))));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [canvasContainerRef.current]);

  useEffect(() => {
    const container = previewCanvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const step = 0.05;
        setPreviewZoomScale(prev => Math.max(0.4, Math.min(2.0, prev + (e.deltaY < 0 ? step : -step))));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [previewCanvasContainerRef.current, isPreviewOpen]);

  // Clear editor references on tab change to prevent calling methods on unmounted/disposed editor instances
  useEffect(() => {
    umlEditorRef.current = null;
    execEditorRef.current = null;
    runnerEditorRef.current = null;
  }, [activeTab]);

  // Position assigner/cleaner
  useEffect(() => {
    let updated = false;
    const newPositions = { ...classPositions };
    umlClasses.forEach((c, idx) => {
      if (!newPositions[c.title]) {
        // Space them out in a clean 3-column grid layout by default
        newPositions[c.title] = {
          x: 40 + (idx % 3) * 320,
          y: 40 + Math.floor(idx / 3) * 360
        };
        updated = true;
      }
    });
    // Remove old classes from coordinates
    const classNames = umlClasses.map(c => c.title);
    Object.keys(newPositions).forEach(name => {
      if (!classNames.includes(name)) {
        delete newPositions[name];
        updated = true;
      }
    });
    if (updated) {
      setClassPositions(newPositions);
    }
  }, [umlClasses]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // Window listeners for moving cards
  useEffect(() => {
    if (!draggingClass) return;

    const handleMouseMove = (e) => {
      // Keep inside bounds of 1500x1200 virtual canvas
      const currentClass = umlClasses.find(x => x.title === draggingClass);
      const cardW = currentClass ? calculateCardWidth(currentClass) : 280;
      const newX = Math.max(0, Math.min(1500 - cardW, e.clientX / zoomScale - dragStartOffset.current.x));
      const newY = Math.max(0, Math.min(1200 - 320, e.clientY / zoomScale - dragStartOffset.current.y));
      setClassPositions(prev => ({
        ...prev,
        [draggingClass]: { x: newX, y: newY }
      }));
    };

    const handleMouseUp = () => {
      setDraggingClass(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingClass, zoomScale]);

  // Window listeners for dragging connection lines
  useEffect(() => {
    if (!connectingSource) return;

    const handleMouseMove = (e) => {
      const canvasEl = document.getElementById('uml-canvas-container');
      if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        setConnectionCurrent({
          x: (e.clientX - rect.left + canvasEl.scrollLeft) / zoomScale,
          y: (e.clientY - rect.top + canvasEl.scrollTop) / zoomScale
        });
      }
    };

    const handleMouseUp = (e) => {
      const x = e.clientX;
      const y = e.clientY;

      let targetClass = null;
      const cards = document.querySelectorAll('.uml-class-card');
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          const name = card.getAttribute('data-classname');
          if (name && name !== connectingSource) {
            targetClass = name;
            break;
          }
        }
      }

      if (targetClass) {
        setNewConnectionData({ source: connectingSource, target: targetClass });
        setNewRelationType('extends');
        setIsConnectionDialogOpen(true);
      }

      setConnectingSource(null);
      setConnectionStart(null);
      setConnectionCurrent(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [connectingSource, zoomScale]);

  const handlePortMouseDown = (e, className, side) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.target.getBoundingClientRect();
    const canvasEl = document.getElementById('uml-canvas-container');
    if (canvasEl) {
      const canvasRect = canvasEl.getBoundingClientRect();
      const startX = (rect.left + rect.width / 2 - canvasRect.left + canvasEl.scrollLeft) / zoomScale;
      const startY = (rect.top + rect.height / 2 - canvasRect.top + canvasEl.scrollTop) / zoomScale;
      
      setConnectingSource(className);
      setConnectionStart({ x: startX, y: startY, side });
      setConnectionCurrent({ x: startX, y: startY });
    }
  };

  const handleConfirmConnection = () => {
    const { source, target } = newConnectionData;
    if (!source || !target) return;

    const sourceIdx = umlClasses.findIndex(c => c.title === source);
    if (sourceIdx !== -1) {
      const sourceClass = umlClasses[sourceIdx];
      const fieldName = newFieldName.trim() || `${target.charAt(0).toLowerCase() + target.slice(1)}`;
      
      if (newRelationType === 'extends') {
        updateClassExtends(sourceIdx, target);
      } else if (newRelationType === 'composition' || newRelationType === 'aggregation' || newRelationType === 'association') {
        const newAttributes = [
          ...sourceClass.attributes,
          {
            name: fieldName,
            type: target,
            visibility: newRelationType === 'association' ? 'public' : 'private',
            isStatic: false
          }
        ];
        
        let newMethods = [...sourceClass.methods];
        if (newRelationType === 'composition') {
          // Look for existing constructor
          const constrIdx = newMethods.findIndex(m => m.returnType === 'constructor');
          if (constrIdx !== -1) {
            const currentBody = newMethods[constrIdx].body || '';
            newMethods[constrIdx] = {
              ...newMethods[constrIdx],
              body: currentBody.trim() 
                ? currentBody.replace(/\s*$/, '') + `\n        this.${fieldName} = new ${target}();\n    `
                : `\n        this.${fieldName} = new ${target}();\n    `
            };
          } else {
            // Create a default constructor
            newMethods.push({
              name: sourceClass.title,
              returnType: 'constructor',
              visibility: 'public',
              isStatic: false,
              isAbstract: false,
              parameters: [],
              body: `\n        this.${fieldName} = new ${target}();\n    `
            });
          }
        }
        
        const newClasses = umlClasses.map((c, idx) => {
          if (idx === sourceIdx) return { ...c, attributes: newAttributes, methods: newMethods };
          return c;
        });
        handleUmlClassesChange(newClasses);
      } else if (newRelationType === 'dependency') {
        // Add dependency method parameter
        const newMethods = [
          ...sourceClass.methods,
          {
            name: `use${target}`,
            returnType: 'void',
            visibility: 'public',
            isStatic: false,
            isAbstract: false,
            parameters: [{ type: target, name: fieldName }],
            body: `\n        // Dependency: USES-A relationship with ${target}\n        System.out.println("Using " + ${fieldName});\n    `
          }
        ];
        const newClasses = umlClasses.map((c, idx) => {
          if (idx === sourceIdx) return { ...c, methods: newMethods };
          return c;
        });
        handleUmlClassesChange(newClasses);
      }
    }

    setIsConnectionDialogOpen(false);
    setNewConnectionData({ source: '', target: '' });
  };

  // Math functions for SVG arrow routes
  const getEstimatedHeight = (title) => {
    const c = umlClasses.find(x => x.title === title);
    if (!c) return 300;
    const attrLen = c.attributes?.length || 0;
    const methLen = c.methods?.length || 0;
    return 120 + attrLen * 34 + methLen * 34;
  };

  const getBestConnectionPoints = (posA, posB) => {
    if (!posA || !posB) return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
    const classA = umlClasses.find(x => x.title === posA.title);
    const classB = umlClasses.find(x => x.title === posB.title);
    const wA = classA ? calculateCardWidth(classA) : 280;
    const wB = classB ? calculateCardWidth(classB) : 280;
    const hA = getEstimatedHeight(posA.title);
    const hB = getEstimatedHeight(posB.title);

    const anchorsA = [
      { x: posA.x + wA / 2, y: posA.y, side: 'top' },
      { x: posA.x + wA / 2, y: posA.y + hA, side: 'bottom' },
      { x: posA.x, y: posA.y + hA / 2, side: 'left' },
      { x: posA.x + wA, y: posA.y + hA / 2, side: 'right' }
    ];

    const anchorsB = [
      { x: posB.x + wB / 2, y: posB.y, side: 'top' },
      { x: posB.x + wB / 2, y: posB.y + hB, side: 'bottom' },
      { x: posB.x, y: posB.y + hB / 2, side: 'left' },
      { x: posB.x + wB, y: posB.y + hB / 2, side: 'right' }
    ];

    let minDist = Infinity;
    let bestA = anchorsA[0];
    let bestB = anchorsB[0];

    for (const a of anchorsA) {
      for (const b of anchorsB) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          bestA = a;
          bestB = b;
        }
      }
    }

    return { start: bestA, end: bestB };
  };

  const getBezierPath = (start, end) => {
    const dx = Math.abs(start.x - end.x);
    const dy = Math.abs(start.y - end.y);
    const offset = Math.min(100, Math.max(30, (dx + dy) * 0.2));

    let cp1 = { x: start.x, y: start.y };
    let cp2 = { x: end.x, y: end.y };

    if (start.side === 'right') cp1.x += offset;
    else if (start.side === 'left') cp1.x -= offset;
    else if (start.side === 'top') cp1.y -= offset;
    else if (start.side === 'bottom') cp1.y += offset;

    if (end.side === 'right') cp2.x += offset;
    else if (end.side === 'left') cp2.x -= offset;
    else if (end.side === 'top') cp2.y -= offset;
    else if (end.side === 'bottom') cp2.y += offset;

    return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
  };

  const getTempPath = (start, current) => {
    const dx = Math.abs(start.x - current.x);
    const dy = Math.abs(start.y - current.y);
    const offset = Math.min(100, Math.max(30, (dx + dy) * 0.2));

    let cp1 = { x: start.x, y: start.y };
    if (start.side === 'right') cp1.x += offset;
    else if (start.side === 'left') cp1.x -= offset;
    else if (start.side === 'top') cp1.y -= offset;
    else if (start.side === 'bottom') cp1.y += offset;

    return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${current.x} ${current.y}, ${current.x} ${current.y}`;
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setIsEditorReady(true);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setIsEditorReady(false);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Refs relocated to the top of the component

  // Sync editor values when tab changes or state updates to avoid stale values
  useEffect(() => {
    if (isTypingRef.current) return;
    
    const clean = (str) => (str || "").replace(/\r\n/g, "\n").trim();
    
    if (activeTab === 'uml') {
      if (umlEditorRef.current) {
        try {
          const currentVal = umlEditorRef.current.getValue();
          if (clean(currentVal) !== clean(code)) {
            umlEditorRef.current.setValue(code);
          }
        } catch (e) {
          console.warn("Failed to sync UML editor (likely disposed):", e);
        }
      }
    } else if (activeTab === 'runner') {
      if (execEditorRef.current) {
        try {
          const currentVal = execEditorRef.current.getValue();
          if (clean(currentVal) !== clean(code)) {
            execEditorRef.current.setValue(code);
          }
        } catch (e) {
          console.warn("Failed to sync Exec editor (likely disposed):", e);
        }
      }
      if (runnerEditorRef.current) {
        try {
          const currentVal = runnerEditorRef.current.getValue();
          if (clean(currentVal) !== clean(mainCode)) {
            runnerEditorRef.current.setValue(mainCode);
          }
        } catch (e) {
          console.warn("Failed to sync Runner editor (likely disposed):", e);
        }
      }
    }
  }, [activeTab, code, mainCode]);

  const getAttributeTypes = (currentType) => {
    const baseTypes = ['int', 'double', 'float', 'boolean', 'char', 'String'];
    const customClassTypes = umlClasses.map(c => c.title);
    const combined = [...baseTypes, ...customClassTypes];
    if (currentType && !combined.includes(currentType)) {
      combined.push(currentType);
    }
    return combined;
  };

  const getMethodReturnTypes = (currentType) => {
    if (currentType === 'constructor') {
      return ['constructor'];
    }
    const baseTypes = ['void', 'int', 'double', 'float', 'boolean', 'char', 'String'];
    const customClassTypes = umlClasses.map(c => c.title);
    const combined = [...baseTypes, ...customClassTypes];
    if (currentType && !combined.includes(currentType)) {
      combined.push(currentType);
    }
    return combined;
  };

  // Sync Code -> UML
  const handleCodeChange = (newCode) => {
    isTypingRef.current = true;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 1000);

    setCode(newCode);
    if (internalUpdateRef.current) return;
    try {
      const parsedClasses = javaToUmlClasses(newCode);
      setUmlClasses(parsedClasses);
    } catch (err) {
      console.warn('Failed to parse Java code to UML:', err);
    }
  };

  // Sync UML -> Code
  const handleUmlClassesChange = (newClasses) => {
    setUmlClasses(newClasses);
    internalUpdateRef.current = true;
    const generatedCode = umlClassesToJava(newClasses);
    setCode(generatedCode);
    setTimeout(() => {
      internalUpdateRef.current = false;
    }, 50);

    if (umlEditorRef.current) {
      const currentVal = umlEditorRef.current.getValue();
      if (currentVal !== generatedCode) {
        umlEditorRef.current.setValue(generatedCode);
      }
    }
    if (execEditorRef.current) {
      const currentVal = execEditorRef.current.getValue();
      if (currentVal !== generatedCode) {
        execEditorRef.current.setValue(generatedCode);
      }
    }
  };

  const loadExample = (idx) => {
    setActiveExampleIndex(idx);
    const ex = ALL_EXAMPLES[idx];
    setClassPositions({}); // Clear positions so examples position correctly
    setCode(ex.code);
    setUmlClasses(javaToUmlClasses(ex.code));
    setMainCode(ex.mainCode);

    if (umlEditorRef.current) {
      umlEditorRef.current.setValue(ex.code);
    }
    if (execEditorRef.current) {
      execEditorRef.current.setValue(ex.code);
    }
    if (runnerEditorRef.current) {
      runnerEditorRef.current.setValue(ex.mainCode);
    }
  };

  // Class Level Operations
  const addClass = () => {
    const newClassName = `NewClass${umlClasses.length + 1}`;
    const newClasses = [
      ...umlClasses,
      { title: newClassName, abstract: false, extends: null, attributes: [], methods: [] }
    ];
    handleUmlClassesChange(newClasses);
  };

  const deleteClass = (classIdx) => {
    const classToDelete = umlClasses[classIdx];
    const newClasses = umlClasses
      .filter((_, idx) => idx !== classIdx)
      .map(c => {
        if (c.extends === classToDelete.title) {
          return { ...c, extends: null };
        }
        return c;
      });
    handleUmlClassesChange(newClasses);
  };

  const updateClassExtends = (classIdx, parentName) => {
    const newClasses = umlClasses.map((c, idx) => {
      if (idx === classIdx) return { ...c, extends: parentName };
      return c;
    });
    handleUmlClassesChange(newClasses);
  };

  const updateClassAbstract = (classIdx, isAbstract) => {
    const newClasses = umlClasses.map((c, idx) => {
      if (idx === classIdx) return { ...c, abstract: isAbstract };
      return c;
    });
    handleUmlClassesChange(newClasses);
  };

  const updateClassTitle = (classIdx, newTitle) => {
    const oldTitle = umlClasses[classIdx].title;
    
    // Rename key in classPositions to preserve coordinate state
    if (classPositions[oldTitle]) {
      setClassPositions(prev => {
        const next = { ...prev };
        next[newTitle] = next[oldTitle];
        delete next[oldTitle];
        return next;
      });
    }

    const newClasses = umlClasses.map((c, idx) => {
      if (idx === classIdx) {
        const updatedMethods = c.methods.map(m => {
          if (m.returnType === 'constructor' || m.name === oldTitle) {
            return { ...m, name: newTitle };
          }
          return m;
        });
        return { ...c, title: newTitle, methods: updatedMethods };
      }
      if (c.extends === oldTitle) {
        return { ...c, extends: newTitle };
      }
      return c;
    });
    handleUmlClassesChange(newClasses);
  };

  // Attribute Operations
  const addAttribute = (classIdx) => {
    const targetClass = umlClasses[classIdx];
    const newAttributes = [
      ...targetClass.attributes,
      { name: `newAttr${targetClass.attributes.length + 1}`, type: 'int', visibility: 'private', isStatic: false }
    ];
    const newClasses = umlClasses.map((c, idx) => {
      if (idx === classIdx) return { ...c, attributes: newAttributes };
      return c;
    });
    handleUmlClassesChange(newClasses);
  };

  const deleteAttribute = (classIdx, attrIdx) => {
    const targetClass = umlClasses[classIdx];
    const newAttributes = targetClass.attributes.filter((_, i) => i !== attrIdx);
    const newClasses = umlClasses.map((c, idx) => {
      if (idx === classIdx) return { ...c, attributes: newAttributes };
      return c;
    });
    handleUmlClassesChange(newClasses);
  };

  const updateAttribute = (classIdx, attrIdx, fields) => {
    const targetClass = umlClasses[classIdx];
    const newAttributes = targetClass.attributes.map((attr, i) => {
      if (i === attrIdx) return { ...attr, ...fields };
      return attr;
    });
    const newClasses = umlClasses.map((c, idx) => {
      if (idx === classIdx) return { ...c, attributes: newAttributes };
      return c;
    });
    handleUmlClassesChange(newClasses);
  };

  // Method Operations
  const addMethod = (classIdx) => {
    const targetClass = umlClasses[classIdx];
    const newMethods = [
      ...targetClass.methods,
      { name: `newMethod${targetClass.methods.length + 1}`, returnType: 'void', visibility: 'public', isStatic: false, isAbstract: false, parameters: [], body: '\n        ' }
    ];
    const newClasses = umlClasses.map((c, idx) => {
      if (idx === classIdx) return { ...c, methods: newMethods };
      return c;
    });
    handleUmlClassesChange(newClasses);
  };

  const deleteMethod = (classIdx, methodIdx) => {
    const targetClass = umlClasses[classIdx];
    const newMethods = targetClass.methods.filter((_, i) => i !== methodIdx);
    const newClasses = umlClasses.map((c, idx) => {
      if (idx === classIdx) return { ...c, methods: newMethods };
      return c;
    });
    handleUmlClassesChange(newClasses);
  };

  const updateMethod = (classIdx, methodIdx, fields) => {
    const targetClass = umlClasses[classIdx];
    const newMethods = targetClass.methods.map((method, i) => {
      if (i === methodIdx) return { ...method, ...fields };
      return method;
    });
    const newClasses = umlClasses.map((c, idx) => {
      if (idx === classIdx) return { ...c, methods: newMethods };
      return c;
    });
    handleUmlClassesChange(newClasses);
  };

  const handleRun = async () => {
    setIsRunning(true);
    setTerminalOutput('');
    setIsWaitingForInput(false);
    setCurrentInputVal('');
    
    try {
      const combinedCode = code + "\n\n// === RUNNER_SECTION_START ===\n\n" + mainCode;
      
      const onStdout = (text) => {
        setTerminalOutput(prev => prev + text);
      };
      
      const onReadInput = () => {
        return new Promise((resolve) => {
          setIsWaitingForInput(true);
          inputResolverRef.current = resolve;
        });
      };
      
      await executeCodeAsync(combinedCode, 'java', onStdout, onReadInput);
    } catch (err) {
      setTerminalOutput(prev => prev + `\n❌ COMPILATION / RUNTIME ERROR: ${err.message}\n`);
    } finally {
      setIsRunning(false);
      setIsWaitingForInput(false);
    }
  };

  const handleInputSubmit = (e) => {
    if (e.key === 'Enter') {
      const val = currentInputVal;
      setTerminalOutput(prev => prev + val + '\n');
      setCurrentInputVal('');
      setIsWaitingForInput(false);
      if (inputResolverRef.current) {
        inputResolverRef.current(val);
      }
    }
  };

  const handleDownloadPreviewPng = async () => {
    try {
      const element = document.getElementById('uml-preview-capture-content');
      if (!element) return;
      
      const oldScale = previewZoomScale;
      setPreviewZoomScale(1.0);
      
      // Wait for React to apply the scale reset
      await new Promise(r => setTimeout(r, 120));

      const canvas = await html2canvas(element, {
        backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc',
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      setPreviewZoomScale(oldScale);

      const link = document.createElement('a');
      link.download = 'uml_diagram.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error exporting UML to PNG:', err);
      alert('Failed to generate PNG of UML diagram: ' + err.message);
    }
  };

  return (
    <>
      <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        style: {
          borderRadius: '24px',
          background: isDarkMode ? 'rgba(20, 20, 42, 0.96)' : 'rgba(250, 252, 255, 0.96)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          maxHeight: '95vh',
          width: '95vw'
        }
      }}
    >
      <DialogTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '12px' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SyncIcon style={{ color: 'var(--primary-main)' }} />
          <Typography variant="h6" style={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif' }}>
            Interactive Java OOP & UML Playground
          </Typography>
        </Box>

        {/* Dialog Switcher Tabs */}
        <Box style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => {
              setActiveTab('uml');
              umlEditorRef.current = null;
              execEditorRef.current = null;
              runnerEditorRef.current = null;
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'uml' ? 'var(--primary-main)' : 'transparent',
              color: activeTab === 'uml' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 850,
              cursor: 'pointer',
              transition: 'all 0.25s ease'
            }}
          >
            2D Visual Class Map
          </button>
          <button
            onClick={() => {
              setActiveTab('runner');
              umlEditorRef.current = null;
              execEditorRef.current = null;
              runnerEditorRef.current = null;
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'runner' ? 'var(--primary-main)' : 'transparent',
              color: activeTab === 'runner' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 850,
              cursor: 'pointer',
              transition: 'all 0.25s ease'
            }}
          >
            Interactive Code Runner
          </button>
        </Box>

        <IconButton onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent style={{ padding: '24px', overflowY: 'auto' }}>
        {activeTab === 'uml' && (
          <Box style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setPreviewZoomScale(zoomScale);
                setIsPreviewOpen(true);
              }}
              startIcon={<PreviewIcon />}
              style={{
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.75rem',
                borderColor: 'var(--primary-main)',
                color: 'var(--primary-main)'
              }}
            >
              Preview UML
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={addClass}
              startIcon={<AddIcon />}
              style={{
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.75rem',
                borderColor: 'var(--primary-main)',
                color: 'var(--primary-main)'
              }}
            >
              Create New Class
            </Button>
          </Box>
        )}

        <Box id="split-container" style={{ display: 'flex', flexDirection: 'row', height: '580px', width: '100%', alignItems: 'stretch', position: 'relative' }}>
          {/* Left Pane: Code Editor */}
          <Box style={{ width: `${splitPercent}%`, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '200px', height: '100%' }}>
            {activeTab === 'runner' ? (
              <Box style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Top: Class Definitions */}
                <Box>
                  <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    Class Definitions (OOP Structures)
                  </Typography>
                  <Box style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                    height: '220px',
                    width: '100%'
                  }}>
                    <Editor
                      key="runner-classes-editor"
                      height="100%"
                      language="java"
                      defaultValue={code}
                      onMount={(editor) => { execEditorRef.current = editor; }}
                      onChange={(val) => handleCodeChange(val || '')}
                      theme={isDarkMode ? 'vs-dark' : 'light'}
                      options={{
                        fontSize: 12,
                        minimap: { enabled: false },
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        padding: { top: 8, bottom: 8 },
                        lineNumbersMinChars: 3
                      }}
                    />
                  </Box>
                </Box>

                {/* Bottom: Main test runner function */}
                <Box>
                  <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    Main Executable (Test Client)
                  </Typography>
                  <Box style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1.5px solid var(--primary-main)',
                    boxShadow: '0 0 15px rgba(61, 92, 255, 0.15)',
                    height: '260px'
                  }}>
                    <Editor
                      key="runner-main-editor"
                      height="100%"
                      language="java"
                      defaultValue={mainCode}
                      onMount={(editor) => { runnerEditorRef.current = editor; }}
                      onChange={(val) => {
                        isTypingRef.current = true;
                        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                        typingTimeoutRef.current = setTimeout(() => {
                          isTypingRef.current = false;
                        }, 1000);
                        setMainCode(val || '');
                      }}
                      theme={isDarkMode ? 'vs-dark' : 'light'}
                      options={{
                        fontSize: 13,
                        minimap: { enabled: false },
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        padding: { top: 10, bottom: 10 },
                        lineNumbersMinChars: 3
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            ) : (
              // Tab 1: Full height editor
              <Box style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
                <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Class Source Code (Java)
                </Typography>
                <Box style={{
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: isDarkMode ? '#1e1e1e' : '#fffffe',
                  boxShadow: '0 4px 25px rgba(0,0,0,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  width: '100%'
                }}>
                  {/* Editor mockup header bar */}
                  <Box style={{
                    background: isDarkMode ? '#252526' : '#f3f3f3',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: isDarkMode ? '1px solid #2d2d2d' : '1px solid #e2e2e2'
                  }}>
                    <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CodeIcon style={{ color: 'var(--primary-main)', fontSize: '1.1rem' }} />
                      <Typography variant="caption" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'none', letterSpacing: '0.02em', fontFamily: 'monospace' }}>
                        BankAccount.java
                      </Typography>
                    </Box>
                    <Box style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }}></span>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }}></span>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }}></span>
                    </Box>
                  </Box>
                  <Box style={{ flexGrow: 1, position: 'relative', width: '100%', height: '100%' }}>
                    {isEditorReady ? (
                      <Editor
                        key="uml-editor"
                        height="100%"
                        language="java"
                        defaultValue={code}
                        onMount={(editor) => { umlEditorRef.current = editor; }}
                        onChange={(val) => handleCodeChange(val || '')}
                        theme={isDarkMode ? 'vs-dark' : 'light'}
                        options={{
                          fontSize: 13,
                          minimap: { enabled: false },
                          automaticLayout: true,
                          scrollBeyondLastLine: false,
                          padding: { top: 12, bottom: 12 },
                          lineNumbersMinChars: 3
                        }}
                      />
                    ) : (
                      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                        <Typography variant="caption" style={{ color: 'var(--text-secondary)' }}>
                          Loading Editor...
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            )}
          </Box>

          {/* Draggable Divider */}
          <Box
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingSplitRef.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            style={{
              width: '8px',
              cursor: 'col-resize',
              backgroundColor: 'transparent',
              position: 'relative',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              marginLeft: '-4px',
              marginRight: '-4px',
            }}
            sx={{
              '&:hover, &:active': {
                backgroundColor: 'var(--primary-main)',
              },
              '&::after': {
                content: '""',
                width: '2px',
                height: '40px',
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                borderRadius: '1px',
              }
            }}
          />

          {/* Right Pane: Swappable Tab Views (UML Class Lab vs. Code Runner) */}
          {activeTab === 'uml' ? (
            <Box style={{ width: `${100 - splitPercent}%`, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '200px', height: '100%' }}>
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Interactive 2D UML Map
                </Typography>
                <Typography variant="caption" style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 700 }}>
                  Drag card headers to arrange them • Drag border circles to link classes
                </Typography>
              </Box>

              <Paper
                id="uml-canvas-container"
                ref={canvasContainerRef}
                onMouseDown={handleCanvasMouseDown}
                elevation={0}
                style={{
                  background: isDarkMode ? '#0b0f19' : '#f3f4f6',
                  border: isDarkMode ? '1.5px solid rgba(255,255,255,0.06)' : '1.5px solid rgba(0,0,0,0.08)',
                  borderRadius: '16px',
                  height: '100%',
                  width: '100%',
                  position: 'relative',
                  overflow: 'auto',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.15)',
                  cursor: 'grab'
                }}
              >
                {/* CSS styles injection */}
                <style dangerouslySetInnerHTML={{ __html: `
                  .uml-port {
                    position: absolute;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background-color: #1CB0F6;
                    border: 2.5px solid ${isDarkMode ? '#1E1E2F' : '#FFFFFF'};
                    cursor: crosshair;
                    z-index: 100;
                    transition: all 0.15s ease-in-out;
                    box-shadow: 0 0 5px rgba(28, 176, 246, 0.4);
                  }
                  .uml-port-top {
                    top: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                  }
                  .uml-port-bottom {
                    bottom: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                  }
                  .uml-port-left {
                    left: -6px;
                    top: 50%;
                    transform: translateY(-50%);
                  }
                  .uml-port-right {
                    right: -6px;
                    top: 50%;
                    transform: translateY(-50%);
                  }
                  .uml-port:hover {
                    background-color: #007bb5;
                    box-shadow: 0 0 12px #1CB0F6, 0 0 5px #1CB0F6;
                  }
                  .uml-port-top:hover {
                    transform: translateX(-50%) scale(1.4) !important;
                  }
                  .uml-port-bottom:hover {
                    transform: translateX(-50%) scale(1.4) !important;
                  }
                  .uml-port-left:hover {
                    transform: translateY(-50%) scale(1.4) !important;
                  }
                  .uml-port-right:hover {
                    transform: translateY(-50%) scale(1.4) !important;
                  }
                `}} />

                {/* Scroll container wrapper to preserve scroll bounds */}
                <Box
                  style={{
                    width: `${1700 * zoomScale}px`,
                    height: `${1500 * zoomScale}px`,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Virtual Canvas Box */}
                  <Box
                    style={{
                      width: '1500px',
                      height: '1200px',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      transform: `scale(${zoomScale})`,
                      transformOrigin: 'top left',
                      backgroundImage: isDarkMode
                        ? 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)'
                        : 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc'
                    }}
                  >
                  <svg
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      zIndex: 2
                    }}
                  >
                    <defs>
                      <marker
                        id="inheritance-arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="8"
                        markerHeight="8"
                        orient="auto-start-reverse"
                      >
                        <polygon
                          points="0,1.5 9,5 0,8.5"
                          fill={isDarkMode ? '#0f172a' : '#f8fafc'}
                          stroke={isDarkMode ? '#3b82f6' : '#1d4ed8'}
                          strokeWidth="1.5"
                        />
                      </marker>
                      <marker
                        id="association-arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="8"
                        markerHeight="8"
                        orient="auto-start-reverse"
                      >
                        <path
                          d="M 1,2 L 9,5 L 1,8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </marker>
                      <marker
                        id="composition-diamond"
                        viewBox="0 0 16 10"
                        refX="2"
                        refY="5"
                        markerWidth="10"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <polygon points="0,5 8,1 16,5 8,9" fill="#8b5cf6" stroke="#8b5cf6" strokeWidth="1.5" />
                      </marker>
                      <marker
                        id="aggregation-diamond"
                        viewBox="0 0 16 10"
                        refX="2"
                        refY="5"
                        markerWidth="10"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <polygon points="0,5 8,1 16,5 8,9" fill={isDarkMode ? '#0f172a' : '#f8fafc'} stroke="#6366f1" strokeWidth="1.8" />
                      </marker>
                    </defs>

                    {analyzeRelationships(umlClasses).map((rel) => {
                      const sourcePos = classPositions[rel.source];
                      const targetPos = classPositions[rel.target];
                      if (sourcePos && targetPos) {
                        const pts = getBestConnectionPoints(
                          { title: rel.source, x: sourcePos.x, y: sourcePos.y },
                          { title: rel.target, x: targetPos.x, y: targetPos.y }
                        );
                        const pathData = getBezierPath(pts.start, pts.end);
                        
                        let strokeColor = '#8b5cf6';
                        let dashArray = 'none';
                        let markerStart = 'none';
                        let markerEnd = 'url(#association-arrow)';
                        
                        if (rel.type === 'extends') {
                          strokeColor = isDarkMode ? '#3b82f6' : '#1d4ed8';
                          markerEnd = 'url(#inheritance-arrow)';
                        } else if (rel.type === 'composition') {
                          strokeColor = '#8b5cf6';
                          markerStart = 'url(#composition-diamond)';
                        } else if (rel.type === 'aggregation') {
                          strokeColor = '#6366f1';
                          markerStart = 'url(#aggregation-diamond)';
                        } else if (rel.type === 'association') {
                          strokeColor = '#14b8a6';
                        } else if (rel.type === 'dependency') {
                          strokeColor = '#f59e0b';
                          dashArray = '4 4';
                        }
                        
                        return (
                          <path
                            key={`${rel.type}-line-${rel.source}-${rel.target}-${rel.fieldName || ''}`}
                            d={pathData}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth="2.5"
                            strokeDasharray={dashArray}
                            markerStart={markerStart}
                            markerEnd={markerEnd}
                          />
                        );
                      }
                      return null;
                    })}

                    {connectingSource && connectionStart && connectionCurrent && (
                      <path
                        d={getTempPath(connectionStart, connectionCurrent)}
                        fill="none"
                        stroke={isDarkMode ? '#1CB0F6' : '#007bb5'}
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                    )}
                  </svg>

                  {/* Absolute Draggable Cards */}
                  {umlClasses.map((umlClass, classIdx) => {
                    const pos = classPositions[umlClass.title] || {
                      x: 40 + (classIdx % 3) * 320,
                      y: 40 + Math.floor(classIdx / 3) * 360
                    };
                    return (
                      <Box
                        key={umlClass.title}
                        className="uml-class-card"
                        data-classname={umlClass.title}
                        style={{
                          position: 'absolute',
                          left: `${pos.x}px`,
                          top: `${pos.y}px`,
                          width: `${calculateCardWidth(umlClass)}px`,
                          border: `2px solid ${theme.palette.primary.main}80`,
                          borderRadius: '12px',
                          background: isDarkMode ? '#1E1E2F' : '#FFFFFF',
                          boxShadow: draggingClass === umlClass.title
                            ? '0 12px 30px rgba(0,0,0,0.35)'
                            : '0 4px 15px rgba(0,0,0,0.15)',
                          zIndex: draggingClass === umlClass.title ? 10 : 3,
                          transition: draggingClass === umlClass.title ? 'none' : 'box-shadow 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        {/* Port circles for drag connecting */}
                        <div className="uml-port uml-port-top" onMouseDown={(e) => handlePortMouseDown(e, umlClass.title, 'top')} />
                        <div className="uml-port uml-port-bottom" onMouseDown={(e) => handlePortMouseDown(e, umlClass.title, 'bottom')} />
                        <div className="uml-port uml-port-left" onMouseDown={(e) => handlePortMouseDown(e, umlClass.title, 'left')} />
                        <div className="uml-port uml-port-right" onMouseDown={(e) => handlePortMouseDown(e, umlClass.title, 'right')} />

                        {/* Header Block (Class Title / Abstract / Extends) */}
                        <Box
                          style={{
                            background: 'rgba(28,176,246,0.08)',
                            padding: '10px',
                            borderBottom: '1.5px solid rgba(28,176,246,0.15)',
                            cursor: draggingClass === umlClass.title ? 'grabbing' : 'grab',
                            userSelect: 'none'
                          }}
                          onMouseDown={(e) => {
                            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest('button') || e.target.closest('.MuiSelect-select')) {
                              return;
                            }
                            setDraggingClass(umlClass.title);
                            dragStartOffset.current = {
                              x: e.clientX / zoomScale - pos.x,
                              y: e.clientY / zoomScale - pos.y
                            };
                          }}
                        >
                          <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <Checkbox
                                size="small"
                                checked={umlClass.abstract}
                                onChange={(e) => updateClassAbstract(classIdx, e.target.checked)}
                                sx={{ padding: 0, color: 'var(--primary-main)' }}
                              />
                              <Typography variant="caption" style={{ color: 'var(--primary-main)', fontWeight: 800 }}>
                                Abstract
                              </Typography>
                            </Box>

                            <IconButton size="small" onClick={() => deleteClass(classIdx)} style={{ color: 'var(--danger-main)', padding: '2px' }}>
                              <DeleteIcon fontSize="inherit" />
                            </IconButton>
                          </Box>

                          <input
                            type="text"
                            value={umlClass.title}
                            onChange={(e) => updateClassTitle(classIdx, e.target.value)}
                            style={{
                              width: '90%',
                              display: 'block',
                              margin: '4px auto',
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1.5px dashed var(--primary-main)',
                              color: isDarkMode ? '#fff' : '#000',
                              textAlign: 'center',
                              fontSize: '0.98rem',
                              fontWeight: 800,
                              fontFamily: '"Outfit", sans-serif',
                              outline: 'none'
                            }}
                          />

                          {/* Extends (Connection) Dropdown */}
                          <Box style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', justifyContent: 'center' }}>
                            <Typography variant="caption" style={{ color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.7rem' }}>
                              extends
                            </Typography>
                            <Select
                              size="small"
                              value={umlClass.extends || 'none'}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateClassExtends(classIdx, val === 'none' ? null : val);
                              }}
                              style={{ height: '22px', fontSize: '0.7rem', fontFamily: 'monospace' }}
                            >
                              <MenuItem value="none">None</MenuItem>
                              {umlClasses
                                .filter(c => c.title !== umlClass.title)
                                .map(c => (
                                  <MenuItem key={c.title} value={c.title}>{c.title}</MenuItem>
                                ))
                              }
                            </Select>
                          </Box>
                        </Box>

                        {/* Attributes Block */}
                        <Box style={{ padding: '10px', borderBottom: '1.5px solid rgba(28,176,246,0.15)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" style={{ fontWeight: 800, color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                              Attributes (Fields)
                            </Typography>
                            <IconButton size="small" onClick={() => addAttribute(classIdx)} style={{ color: 'var(--primary-main)', padding: '2px' }}>
                              <AddIcon fontSize="inherit" />
                            </IconButton>
                          </Box>

                          {umlClass.attributes.map((attr, attrIdx) => (
                            <Box key={attrIdx} style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <Box style={{ display: 'flex', gap: '4px', width: '100%', alignItems: 'center' }}>
                                <Select
                                  size="small"
                                  value={attr.visibility}
                                  onChange={(e) => updateAttribute(classIdx, attrIdx, { visibility: e.target.value })}
                                  style={{ height: '24px', fontSize: '0.72rem', fontFamily: 'monospace' }}
                                >
                                  <MenuItem value="public">+</MenuItem>
                                  <MenuItem value="private">-</MenuItem>
                                  <MenuItem value="protected">#</MenuItem>
                                </Select>
                                <Select
                                  size="small"
                                  value={attr.type}
                                  onChange={(e) => updateAttribute(classIdx, attrIdx, { type: e.target.value })}
                                  style={{
                                    height: '24px',
                                    fontSize: '0.72rem',
                                    fontFamily: 'monospace',
                                    background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                    border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                    borderRadius: '4px',
                                    color: isDarkMode ? '#ffffff' : '#1e1e2f',
                                    width: `${Math.max(70, (attr.type ? attr.type.length : 0) * 8 + 24)}px`,
                                    padding: 0
                                  }}
                                  sx={{
                                    '& .MuiSelect-select': {
                                      paddingTop: '2px',
                                      paddingBottom: '2px',
                                      paddingLeft: '6px',
                                      paddingRight: '20px'
                                    }
                                  }}
                                >
                                  {getAttributeTypes(attr.type).map(t => (
                                    <MenuItem key={t} value={t} style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{t}</MenuItem>
                                  ))}
                                </Select>
                                <input
                                  type="text"
                                  value={attr.name}
                                  placeholder="name"
                                  onChange={(e) => updateAttribute(classIdx, attrIdx, { name: e.target.value })}
                                  style={{
                                    flexGrow: 1,
                                    minWidth: '40px',
                                    background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                    border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                    borderRadius: '4px',
                                    color: isDarkMode ? '#ffffff' : '#1e1e2f',
                                    fontSize: '0.72rem',
                                    padding: '2px 4px',
                                    fontFamily: 'monospace',
                                    outline: 'none'
                                  }}
                                />
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={attr.isStatic}
                                      onChange={(e) => updateAttribute(classIdx, attrIdx, { isStatic: e.target.checked })}
                                      sx={{ padding: 0 }}
                                    />
                                  }
                                  label="S"
                                  style={{ margin: 0 }}
                                  slotProps={{ typography: { style: { fontSize: '0.6rem', fontWeight: 800, marginLeft: '1px' } } }}
                                />
                                <IconButton size="small" onClick={() => deleteAttribute(classIdx, attrIdx)} style={{ color: 'var(--danger-main)', padding: '2px' }}>
                                  <DeleteIcon fontSize="inherit" />
                                </IconButton>
                              </Box>
                            </Box>
                          ))}
                        </Box>

                        {/* Methods Block */}
                        <Box style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" style={{ fontWeight: 800, color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                              Methods (Actions)
                            </Typography>
                            <IconButton size="small" onClick={() => addMethod(classIdx)} style={{ color: 'var(--primary-main)', padding: '2px' }}>
                              <AddIcon fontSize="inherit" />
                            </IconButton>
                          </Box>

                          {umlClass.methods.map((method, methodIdx) => (
                            <Box key={methodIdx} style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'nowrap' }}>
                              <Select
                                size="small"
                                value={method.visibility}
                                onChange={(e) => updateMethod(classIdx, methodIdx, { visibility: e.target.value })}
                                style={{ height: '24px', fontSize: '0.72rem', fontFamily: 'monospace' }}
                              >
                                <MenuItem value="public">+</MenuItem>
                                <MenuItem value="private">-</MenuItem>
                                <MenuItem value="protected">#</MenuItem>
                              </Select>
                              <Select
                                size="small"
                                value={method.returnType}
                                disabled={method.returnType === 'constructor'}
                                onChange={(e) => updateMethod(classIdx, methodIdx, { returnType: e.target.value })}
                                style={{
                                  height: '24px',
                                  fontSize: '0.72rem',
                                  fontFamily: 'monospace',
                                  background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                  border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                  borderRadius: '4px',
                                  color: isDarkMode ? '#ffffff' : '#1e1e2f',
                                  width: `${Math.max(70, (method.returnType ? method.returnType.length : 0) * 8 + 24)}px`,
                                  padding: 0
                                }}
                                sx={{
                                  '& .MuiSelect-select': {
                                    paddingTop: '2px',
                                    paddingBottom: '2px',
                                    paddingLeft: '6px',
                                    paddingRight: '20px'
                                  }
                                }}
                              >
                                {getMethodReturnTypes(method.returnType).map(t => (
                                  <MenuItem key={t} value={t} style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{t}</MenuItem>
                                ))}
                              </Select>
                              <input
                                type="text"
                                value={method.name}
                                placeholder="name"
                                onChange={(e) => updateMethod(classIdx, methodIdx, { name: e.target.value })}
                                style={{
                                  flexGrow: 1,
                                  minWidth: '40px',
                                  background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                  border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                  borderRadius: '4px',
                                  color: isDarkMode ? '#ffffff' : '#1e1e2f',
                                  fontSize: '0.72rem',
                                  padding: '2px 4px',
                                  fontFamily: 'monospace',
                                  outline: 'none'
                                }}
                              />
                              <Box style={{ display: 'flex', gap: '2px' }}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={method.isStatic}
                                      onChange={(e) => updateMethod(classIdx, methodIdx, { isStatic: e.target.checked })}
                                      sx={{ padding: 0 }}
                                    />
                                  }
                                  label="S"
                                  style={{ margin: 0 }}
                                  slotProps={{ typography: { style: { fontSize: '0.6rem', fontWeight: 800 } } }}
                                />
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={method.isAbstract}
                                      onChange={(e) => updateMethod(classIdx, methodIdx, { isAbstract: e.target.checked })}
                                      sx={{ padding: 0 }}
                                    />
                                  }
                                  label="A"
                                  style={{ margin: 0 }}
                                  slotProps={{ typography: { style: { fontSize: '0.6rem', fontWeight: 800 } } }}
                                />
                              </Box>
                              <IconButton size="small" onClick={() => deleteMethod(classIdx, methodIdx)} style={{ color: 'var(--danger-main)', padding: '2px' }}>
                                <DeleteIcon fontSize="inherit" />
                              </IconButton>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    );
                  })}
                  </Box>
                </Box>
                {/* Floating zoom control panel */}
                <Box
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isDarkMode ? 'rgba(30, 30, 47, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(10px)',
                    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
                    zIndex: 10
                  }}
                >
                  <IconButton 
                    size="small" 
                    onClick={() => setZoomScale(prev => Math.max(0.4, prev - 0.1))}
                    style={{ color: isDarkMode ? '#e0e0e0' : '#333' }}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="caption" style={{ fontFamily: 'monospace', fontWeight: 800, minWidth: '40px', textAlign: 'center', color: isDarkMode ? '#fff' : '#000' }}>
                    {Math.round(zoomScale * 100)}%
                  </Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => setZoomScale(prev => Math.min(2.0, prev + 0.1))}
                    style={{ color: isDarkMode ? '#e0e0e0' : '#333' }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <Button 
                    size="small" 
                    onClick={() => setZoomScale(1.0)}
                    style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'none', color: 'var(--primary-main)', minWidth: 0, padding: '2px 6px' }}
                  >
                    Reset
                  </Button>
                </Box>
              </Paper>
            </Box>
          ) : (
            <Box style={{ width: `${100 - splitPercent}%`, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '200px', height: '100%' }}>
              <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Interactive Java Console
              </Typography>

              <Paper
                elevation={0}
                style={{
                  background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                  border: '1.5px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px',
                  padding: '20px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto'
                }}
              >
                {/* Run button */}
                <Button
                  variant="contained"
                  fullWidth
                  disabled={isRunning}
                  onClick={handleRun}
                  startIcon={<PlayIcon />}
                  style={{
                    background: 'linear-gradient(135deg, #1CB0F6, #007bb5)',
                    color: '#fff',
                    borderRadius: '12px',
                    fontWeight: 800,
                    textTransform: 'none',
                    padding: '8px 16px',
                    boxShadow: '0 4px 15px rgba(28, 176, 246, 0.25)'
                  }}
                >
                  {isRunning ? 'Running Java Simulation...' : 'Run Java Code'}
                </Button>

                {/* Output console terminal */}
                <Box style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Typography variant="caption" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Console Output Terminal
                  </Typography>
                  <Paper
                    elevation={0}
                    style={{
                      flexGrow: 1,
                      padding: '16px',
                      backgroundColor: '#05070f',
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      fontFamily: '"Roboto Mono", monospace',
                      fontSize: '0.8rem',
                      color: '#3DDC97',
                      whiteSpace: 'pre-wrap',
                      overflowY: 'auto',
                      minHeight: '180px',
                      boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start'
                    }}
                  >
                    <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                      {terminalOutput}
                      {isWaitingForInput && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <span style={{ color: '#FF9F43', fontWeight: 800 }}>{`> `}</span>
                          <input
                            type="text"
                            value={currentInputVal}
                            onChange={(e) => setCurrentInputVal(e.target.value)}
                            onKeyDown={handleInputSubmit}
                            autoFocus
                            placeholder="Type input and press Enter..."
                            style={{
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: '#3DDC97',
                              fontFamily: '"Roboto Mono", monospace',
                              fontSize: '0.82rem',
                              flexGrow: 1,
                              caretColor: '#3DDC97'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </Paper>
                </Box>
              </Paper>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          {activeTab === 'uml' 
            ? '💡 Pro-tip: Edits in the code editor instantly sync to the 2D map. Changes to the UML cards also update the source code automatically without losing your custom method bodies!'
            : '💡 Pro-tip: You can write test code directly inside the runner tab on the left to interact with your classes, then click "Run Java Code" to see the output in the console!'
          }
        </Typography>
        <Button variant="outlined" onClick={onClose} style={{ borderRadius: '12px', fontWeight: 800 }}>
          Close
        </Button>
      </DialogActions>

      {/* Create Connection Dialog */}
      <Dialog
        open={isConnectionDialogOpen}
        onClose={() => setIsConnectionDialogOpen(false)}
        PaperProps={{
          style: {
            borderRadius: '16px',
            background: isDarkMode ? '#1e1e2f' : '#ffffff',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '16px',
            width: '400px'
          }
        }}
      >
        <DialogTitle style={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif', paddingBottom: '8px' }}>
          Create Link from {newConnectionData.source}
        </DialogTitle>
        <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
          <Typography variant="body2" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Configure the relationship properties below:
          </Typography>

          {/* Target Class Dropdown */}
          <Box style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Typography variant="caption" style={{ fontWeight: 850, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              Target Class
            </Typography>
            <Select
              value={newConnectionData.target || ''}
              onChange={(e) => {
                const selectedTarget = e.target.value;
                setNewConnectionData(prev => ({ ...prev, target: selectedTarget }));
              }}
              fullWidth
              size="small"
              style={{ borderRadius: '8px' }}
            >
              {umlClasses
                .filter(c => c.title !== newConnectionData.source)
                .map(c => (
                  <MenuItem key={c.title} value={c.title}>{c.title}</MenuItem>
                ))
              }
            </Select>
          </Box>
          
          {/* Relationship Type Dropdown */}
          <Box style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Typography variant="caption" style={{ fontWeight: 850, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              Relationship Connection Type
            </Typography>
            <Select
              value={newRelationType}
              onChange={(e) => setNewRelationType(e.target.value)}
              fullWidth
              size="small"
              style={{ borderRadius: '8px' }}
            >
              <MenuItem value="extends">Inheritance (extends)</MenuItem>
              <MenuItem value="composition">Composition (Has-A, instantiated in constructor)</MenuItem>
              <MenuItem value="aggregation">Aggregation (Has-A reference, private field)</MenuItem>
              <MenuItem value="association">Association (Has-A reference, public field)</MenuItem>
              <MenuItem value="dependency">Dependency (Uses-A parameter in new method)</MenuItem>
            </Select>
          </Box>

          {/* Conditional Variable/Parameter Input */}
          {newRelationType !== 'extends' && (
            <TextField
              label="Variable / Parameter Name"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g. engine"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px'
                }
              }}
            />
          )}
        </DialogContent>
        <DialogActions style={{ padding: '8px 16px' }}>
          <Button onClick={() => setIsConnectionDialogOpen(false)} style={{ borderRadius: '8px', fontWeight: 800 }}>
            Cancel
          </Button>
          <Button onClick={handleConfirmConnection} variant="contained" style={{ borderRadius: '8px', fontWeight: 800, background: 'var(--primary-main)', color: '#fff' }}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>

    {/* Fullscreen UML Preview Dialog */}
    <Dialog
      open={isPreviewOpen}
      onClose={() => setIsPreviewOpen(false)}
      fullScreen
      PaperProps={{
        style: {
          background: isDarkMode ? '#0b0f19' : '#f3f4f6',
        }
      }}
    >
      <DialogTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <PreviewIcon style={{ color: 'var(--primary-main)' }} />
          <Typography variant="h6" style={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif', color: isDarkMode ? '#fff' : '#000' }}>
            UML Diagram Fullscreen Preview
          </Typography>
        </Box>
        <Box style={{ display: 'flex', gap: '12px' }}>
          <Button variant="outlined" onClick={handleDownloadPreviewPng} style={{ borderRadius: '12px', fontWeight: 800 }}>
            Download PNG
          </Button>
          <Button variant="outlined" onClick={() => setIsPreviewOpen(false)} style={{ borderRadius: '12px', fontWeight: 800 }}>
            Close Preview
          </Button>
        </Box>
      </DialogTitle>
      
      <DialogContent style={{ padding: 0, overflow: 'hidden', position: 'relative', height: '100%', width: '100%' }}>
        <Paper
          id="uml-preview-canvas-container"
          ref={previewCanvasContainerRef}
          onMouseDown={handlePreviewCanvasMouseDown}
          elevation={0}
          style={{
            background: isDarkMode ? '#0b0f19' : '#f3f4f6',
            height: '100%',
            width: '100%',
            position: 'relative',
            overflow: 'auto',
            cursor: 'grab'
          }}
        >
          {/* Virtual Canvas Box */}
          <Box
            style={{
              width: `${1500 * previewZoomScale}px`,
              height: `${1200 * previewZoomScale}px`,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box
              id="uml-preview-capture-content"
              style={{
                width: '1500px',
                height: '1200px',
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `scale(${previewZoomScale})`,
                transformOrigin: 'top left',
                backgroundImage: isDarkMode
                  ? 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)'
                  : 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc'
              }}
            >
              {/* SVG lines */}
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 2
                }}
              >
                <defs>
                  <marker
                    id="preview-inheritance-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                  >
                    <polygon
                      points="0,1.5 9,5 0,8.5"
                      fill={isDarkMode ? '#0f172a' : '#f8fafc'}
                      stroke={isDarkMode ? '#3b82f6' : '#1d4ed8'}
                      strokeWidth="1.5"
                    />
                  </marker>
                  <marker
                    id="preview-association-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                  >
                    <path
                      d="M 1,2 L 9,5 L 1,8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </marker>
                  <marker
                    id="preview-composition-diamond"
                    viewBox="0 0 16 10"
                    refX="2"
                    refY="5"
                    markerWidth="10"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <polygon points="0,5 8,1 16,5 8,9" fill="#8b5cf6" stroke="#8b5cf6" strokeWidth="1.5" />
                  </marker>
                  <marker
                    id="preview-aggregation-diamond"
                    viewBox="0 0 16 10"
                    refX="2"
                    refY="5"
                    markerWidth="10"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <polygon points="0,5 8,1 16,5 8,9" fill={isDarkMode ? '#0f172a' : '#f8fafc'} stroke="#6366f1" strokeWidth="1.8" />
                  </marker>
                </defs>

                {analyzeRelationships(umlClasses).map((rel) => {
                  const sourcePos = classPositions[rel.source];
                  const targetPos = classPositions[rel.target];
                  if (sourcePos && targetPos) {
                    const pts = getBestConnectionPoints(
                      { title: rel.source, x: sourcePos.x, y: sourcePos.y },
                      { title: rel.target, x: targetPos.x, y: targetPos.y }
                    );
                    const pathData = getBezierPath(pts.start, pts.end);
                    
                    let strokeColor = '#8b5cf6';
                    let dashArray = 'none';
                    let markerStart = 'none';
                    let markerEnd = 'url(#preview-association-arrow)';
                    
                    if (rel.type === 'extends') {
                      strokeColor = isDarkMode ? '#3b82f6' : '#1d4ed8';
                      markerEnd = 'url(#preview-inheritance-arrow)';
                    } else if (rel.type === 'composition') {
                      strokeColor = '#8b5cf6';
                      markerStart = 'url(#preview-composition-diamond)';
                    } else if (rel.type === 'aggregation') {
                      strokeColor = '#6366f1';
                      markerStart = 'url(#preview-aggregation-diamond)';
                    } else if (rel.type === 'association') {
                      strokeColor = '#14b8a6';
                    } else if (rel.type === 'dependency') {
                      strokeColor = '#f59e0b';
                      dashArray = '4 4';
                    }
                    
                    return (
                      <path
                        key={`preview-${rel.type}-line-${rel.source}-${rel.target}-${rel.fieldName || ''}`}
                        d={pathData}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="2.5"
                        strokeDasharray={dashArray}
                        markerStart={markerStart}
                        markerEnd={markerEnd}
                      />
                    );
                  }
                  return null;
                })}
              </svg>

              {/* Absolute Read-only Cards */}
              {umlClasses.map((umlClass, classIdx) => {
                const pos = classPositions[umlClass.title] || {
                  x: 40 + (classIdx % 3) * 320,
                  y: 40 + Math.floor(classIdx / 3) * 360
                };
                return (
                  <Box
                    key={`preview-${umlClass.title}`}
                    style={{
                      position: 'absolute',
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      width: `${calculateCardWidth(umlClass)}px`,
                      border: `2.5px solid ${theme.palette.primary.main}`,
                      borderRadius: '12px',
                      background: isDarkMode ? '#1E1E2F' : '#FFFFFF',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                      zIndex: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '10px'
                    }}
                  >
                    {/* Class Title */}
                    <Box style={{ borderBottom: '1.5px solid rgba(28,176,246,0.15)', paddingBottom: '6px', marginBottom: '8px', textAlign: 'center' }}>
                      {umlClass.abstract && (
                        <Typography variant="caption" style={{ color: 'var(--primary-main)', fontWeight: 800, display: 'block', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                          &lt;&lt;Abstract&gt;&gt;
                        </Typography>
                      )}
                      <Typography variant="subtitle2" style={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif', color: isDarkMode ? '#fff' : '#000' }}>
                        {umlClass.title}
                      </Typography>
                      {umlClass.extends && (
                        <Typography variant="caption" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                          extends {umlClass.extends}
                        </Typography>
                      )}
                    </Box>

                    {/* Attributes List */}
                    {umlClass.attributes.length > 0 && (
                      <Box style={{ borderBottom: '1.5px solid rgba(28,176,246,0.15)', paddingBottom: '6px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {umlClass.attributes.map((attr, attrIdx) => {
                          const visSign = attr.visibility === 'public' ? '+' : (attr.visibility === 'protected' ? '#' : '-');
                          return (
                            <Typography
                              key={attrIdx}
                              variant="caption"
                              style={{
                                fontFamily: 'monospace',
                                color: isDarkMode ? '#e0e0e0' : '#333',
                                textDecoration: attr.isStatic ? 'underline' : 'none',
                                fontWeight: attr.isStatic ? 800 : 400
                              }}
                            >
                              {visSign} {attr.name}: {attr.type}
                            </Typography>
                          );
                        })}
                      </Box>
                    )}

                    {/* Methods List */}
                    {umlClass.methods.length > 0 && (
                      <Box style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {umlClass.methods.map((method, methodIdx) => {
                          const visSign = method.visibility === 'public' ? '+' : (method.visibility === 'protected' ? '#' : '-');
                          const paramsText = (method.parameters || []).map(p => `${p.name}: ${p.type}`).join(', ');
                          const retText = method.returnType === 'constructor' ? '' : `: ${method.returnType}`;
                          return (
                            <Typography
                              key={methodIdx}
                              variant="caption"
                              style={{
                                fontFamily: 'monospace',
                                color: isDarkMode ? '#e0e0e0' : '#333',
                                textDecoration: method.isStatic ? 'underline' : 'none',
                                fontStyle: method.isAbstract ? 'italic' : 'normal',
                                fontWeight: (method.isStatic || method.isAbstract) ? 800 : 400
                              }}
                            >
                              {visSign} {method.name}({paramsText}){retText}
                            </Typography>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Paper>

        {/* Floating zoom control bar in preview */}
        <Box
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: isDarkMode ? 'rgba(30, 30, 47, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(10px)',
            border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
            padding: '4px 12px',
            borderRadius: '20px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
            zIndex: 10
          }}
        >
          <IconButton 
            size="small" 
            onClick={() => setPreviewZoomScale(prev => Math.max(0.4, prev - 0.1))}
            style={{ color: isDarkMode ? '#e0e0e0' : '#333' }}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" style={{ fontFamily: 'monospace', fontWeight: 800, minWidth: '40px', textAlign: 'center', color: isDarkMode ? '#fff' : '#000' }}>
            {Math.round(previewZoomScale * 100)}%
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => setPreviewZoomScale(prev => Math.min(2.0, prev + 0.1))}
            style={{ color: isDarkMode ? '#e0e0e0' : '#333' }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
          <Button 
            size="small" 
            onClick={() => setPreviewZoomScale(1.0)}
            style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'none', color: 'var(--primary-main)', minWidth: 0, padding: '2px 6px' }}
          >
            Reset
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
    </>
  );
};
