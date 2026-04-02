import React from 'react';

const Placeholder = ({ name }: { name: string }) => (
  <div className="p-8">
    <h2 className="text-2xl font-bold">{name}</h2>
    <p className="text-muted-foreground mt-2">This page is under construction.</p>
  </div>
);

export default Placeholder;
