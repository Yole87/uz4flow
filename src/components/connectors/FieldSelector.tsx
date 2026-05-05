import { useState } from "react";
import { ChevronRight, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldMapping {
  path: string;
  label: string;
}

interface FieldSelectorProps {
  payload: Record<string, unknown>;
  selectedFields: FieldMapping[];
  onFieldSelect: (path: string, label: string, selected: boolean) => void;
}

interface TreeNodeProps {
  name: string;
  value: unknown;
  path: string;
  selectedPaths: string[];
  onSelect: (path: string, label: string, selected: boolean) => void;
  depth?: number;
}

function TreeNode({ name, value, path, selectedPaths, onSelect, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isSelected = selectedPaths.includes(path);
  const isPrimitive = !isObject && !isArray;

  const getTypeLabel = () => {
    if (isArray) return `array[${(value as unknown[]).length}]`;
    if (isObject) return "object";
    if (value === null) return "null";
    return typeof value;
  };

  const getValuePreview = () => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") {
      return value.length > 50 ? `"${value.substring(0, 50)}..."` : `"${value}"`;
    }
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return String(value);
    return null;
  };

  const handleClick = () => {
    if (isPrimitive) {
      onSelect(path, name, !isSelected);
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors",
          isPrimitive && "hover:bg-accent",
          isSelected && "bg-primary/10"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Icon */}
        {(isObject || isArray) && (
          <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        )}
        
        {/* Selection Checkbox */}
        {isPrimitive && (
          <span
            className={cn(
              "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
              isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
            )}
          >
            {isSelected && <Check className="h-3 w-3" />}
          </span>
        )}
        
        {/* Field Name */}
        <span className={cn(
          "font-mono text-sm",
          isSelected && "text-primary font-medium"
        )}>
          {name}
        </span>
        
        {/* Type Badge */}
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          {getTypeLabel()}
        </span>
        
        {/* Value Preview */}
        {isPrimitive && (
          <span className="text-sm text-muted-foreground truncate flex-1">
            {getValuePreview()}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && isObject && (
        <div>
          {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
            <TreeNode
              key={`${path}.${key}`}
              name={key}
              value={val}
              path={`${path}.${key}`}
              selectedPaths={selectedPaths}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {expanded && isArray && (
        <div>
          {(value as unknown[]).slice(0, 5).map((item, index) => (
            <TreeNode
              key={`${path}[${index}]`}
              name={`[${index}]`}
              value={item}
              path={`${path}[${index}]`}
              selectedPaths={selectedPaths}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
          {(value as unknown[]).length > 5 && (
            <div
              className="text-xs text-muted-foreground py-1"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              ... e mais {(value as unknown[]).length - 5} itens
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FieldSelector({ payload, selectedFields, onFieldSelect }: FieldSelectorProps) {
  const selectedPaths = selectedFields.map(f => f.path);

  return (
    <div className="border rounded-lg p-2 max-h-96 overflow-auto bg-card">
      <div className="text-xs text-muted-foreground px-2 py-1 mb-2 border-b">
        Clique nos campos para selecioná-los
      </div>
      {Object.entries(payload).map(([key, value]) => (
        <TreeNode
          key={key}
          name={key}
          value={value}
          path={key}
          selectedPaths={selectedPaths}
          onSelect={onFieldSelect}
        />
      ))}
    </div>
  );
}
