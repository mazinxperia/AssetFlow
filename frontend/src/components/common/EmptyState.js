import React from 'react';
import { CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function EmptyState({ 
  icon: Icon = Info, 
  title, 
  description, 
  action,
  className 
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-heading font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}

export function ErrorState({ 
  title = "Something went wrong", 
  description, 
  action,
  className 
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <XCircle className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-lg font-heading font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}

export function SuccessState({ 
  title = "Success!", 
  description, 
  action,
  className 
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
        <CheckCircle className="w-8 h-8 text-success" />
      </div>
      <h3 className="text-lg font-heading font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}
