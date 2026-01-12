// import React, { useEffect, useState } from "react";
// import "../pages-css/NewRolePermissions.css";

// const API = process.env.REACT_APP_API_URL;

// function NewRolePermissions() {
//   const [roles, setRoles] = useState([]);
//   const [permissions, setPermissions] = useState([]);

//   const [roleName, setRoleName] = useState("");
//   const [roleDescription, setRoleDescription] = useState("");

//   const [permissionName, setPermissionName] = useState("");
//   const [permissionDescription, setPermissionDescription] = useState("");

//   const [selectedRoleId, setSelectedRoleId] = useState("");
//   const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);

//   /* ================= LOAD DATA ================= */
//   useEffect(() => {
//     loadData();
//   }, []);

//   const loadData = async () => {
//     try {
//       const [r, p] = await Promise.all([
//         fetch(`${API}/roles/getAllRoles`).then(res => res.json()),
//         fetch(`${API}/permissions/getAllPermissions`).then(res => res.json())
//       ]);
//       setRoles(r);
//       setPermissions(p);
//     } catch (e) {
//       alert("Failed to load roles or permissions");
//       console.error(e);
//     }
//   };

//   /* ================= CREATE ROLE ================= */
//   const createRole = async () => {
//     if (!roleName.trim()) {
//       alert("Role name required");
//       return;
//     }

//     try {
//       const response = await fetch(`${API}/roles/addNewRole`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           name: roleName,
//           description: roleDescription
//         })
//       });

//       const {message} = await response.json();

//       if (!response.ok) {
//         alert(message || "Failed to create role");
//         return;
//       }

//       alert(message);
//       setRoleName("");
//       setRoleDescription("");
//       loadData();

//     } catch (err) {
//       alert("Network error while creating role");
//       console.error(err);
//     }
//   };

//   /* ================= CREATE PERMISSION ================= */
//   const createPermission = async () => {
//     if (!permissionName.trim()) {
//       alert("Permission name required");
//       return;
//     }

//     try {
//       const response = await fetch(`${API}/permissions/addNewPermission`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           name: permissionName,
//           description: permissionDescription
//         })
//       });

//       const {message} = await response.json();

//       if (!response.ok) {
//         alert(message || "Failed to create permission");
//         return;
//       }

//       alert(message);
//       setPermissionName("");
//       setPermissionDescription("");
//       loadData();

//     } catch (err) {
//       alert("Network error while creating permission");
//       console.error(err);
//     }
//   };

//   /* ================= GROUP PERMISSIONS ================= */
//   const groupedPermissions = permissions.reduce((acc, perm) => {
//     const group = perm.name.includes(".")
//       ? perm.name.split(".")[0]
//       : "other";
//     if (!acc[group]) acc[group] = [];
//     acc[group].push(perm);
//     return acc;
//   }, {});

//   /* ================= TOGGLE GROUP ================= */
//   const toggleGroup = (groupPerms, checked) => {
//     const ids = groupPerms.map(p => p.id);
//     setSelectedPermissionIds(prev =>
//       checked
//         ? Array.from(new Set([...prev, ...ids]))
//         : prev.filter(id => !ids.includes(id))
//     );
//   };

//   /* ================= TOGGLE SINGLE ================= */
//   const togglePermission = (id) => {
//     setSelectedPermissionIds(prev =>
//       prev.includes(id)
//         ? prev.filter(p => p !== id)
//         : [...prev, id]
//     );
//   };

//   /* ================= ASSIGN ================= */
//   const assignPermissions = async () => {
//     if (!selectedRoleId) {
//       alert("Please select a role");
//       return;
//     }

//     if (selectedPermissionIds.length === 0) {
//       alert("Please select at least one permission");
//       return;
//     }

//     try {
//       const response = await fetch(`${API}/role-permission/assignPermissions`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           role_id: selectedRoleId,
//           permission_ids: selectedPermissionIds
//         })
//       });

//       const message = await response.text();

//       if (!response.ok) {
//         alert(message || "Failed to assign permissions");
//         return;
//       }

//       alert(message || "Permissions assigned successfully");
//       setSelectedPermissionIds([]);

//     } catch (err) {
//       alert("Network error while assigning permissions");
//       console.error(err);
//     }
//   };

//   return (
//     <div className="nr-page">
//       <div className="nr-header">
//         <h2 className="nr-title">Role & Permission Management</h2>
//         <p className="nr-subtitle">
//           Create roles, permissions and assign access
//         </p>
//       </div>

//       <div className="nr-grid">
//         {/* CREATE ROLE */}
//         <div className="nr-card">
//           <h3 className="nr-card-title">Create Role</h3>

//           <label className="nr-label">Role Name</label>
//           <input
//             className="nr-input"
//             value={roleName}
//             onChange={e => setRoleName(e.target.value)}
//           />

//           <label className="nr-label">Description</label>
//           <textarea
//             className="nr-textarea"
//             value={roleDescription}
//             onChange={e => setRoleDescription(e.target.value)}
//           />

//           <button className="nr-btn-primary" onClick={createRole}>
//             Create Role
//           </button>
//         </div>

//         {/* CREATE PERMISSION */}
//         <div className="nr-card">
//           <h3 className="nr-card-title">Create Permission</h3>

//           <label className="nr-label">Permission Name</label>
//           <input
//             className="nr-input"
//             value={permissionName}
//             onChange={e => setPermissionName(e.target.value)}
//           />

//           <label className="nr-label">Description</label>
//           <textarea
//             className="nr-textarea"
//             value={permissionDescription}
//             onChange={e => setPermissionDescription(e.target.value)}
//           />

//           <button className="nr-btn-primary" onClick={createPermission}>
//             Create Permission
//           </button>
//         </div>

//         {/* ASSIGN PERMISSIONS */}
//         <div className="nr-card nr-card-full">
//           <h3 className="nr-card-title">Assign Permissions</h3>

//           <label className="nr-label">Select Role</label>
//           <select
//             className="nr-select"
//             value={selectedRoleId}
//             onChange={e => setSelectedRoleId(Number(e.target.value))}
//           >
//             <option value="">Select Role</option>
//             {roles.map(r => (
//               <option key={r.id} value={r.id}>{r.name}</option>
//             ))}
//           </select>

//           {Object.entries(groupedPermissions).map(([group, perms]) => {
//             const allChecked = perms.every(p =>
//               selectedPermissionIds.includes(p.id)
//             );

//             return (
//               <div key={group} className="nr-permission-group">
//                 <label className="nr-group-title">
//                   <input
//                     type="checkbox"
//                     checked={allChecked}
//                     onChange={e => toggleGroup(perms, e.target.checked)}
//                   />
//                   {group.toUpperCase()}
//                 </label>

//                 <div className="nr-permission-children">
//                   {perms.map(p => (
//                     <label key={p.id} className="nr-checkbox">
//                       <input
//                         type="checkbox"
//                         checked={selectedPermissionIds.includes(p.id)}
//                         onChange={() => togglePermission(p.id)}
//                       />
//                       {p.name}
//                     </label>
//                   ))}
//                 </div>
//               </div>
//             );
//           })}

//           <button className="nr-btn-primary" onClick={assignPermissions}>
//             Save Permissions
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default NewRolePermissions;


import React, { useEffect, useState } from "react";
import "../pages-css/NewRolePermissions.css";

const API = process.env.REACT_APP_API_URL;

function NewRolePermissions() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);

  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");

  const [permissionName, setPermissionName] = useState("");
  const [permissionDescription, setPermissionDescription] = useState("");

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [r, p] = await Promise.all([
        fetch(`${API}/roles/getAllRoles`).then(res => res.json()),
        fetch(`${API}/permissions/getAllPermissions`).then(res => res.json())
      ]);
      setRoles(r);
      setPermissions(p);
    } catch (e) {
      alert("Failed to load roles or permissions");
      console.error(e);
    }
  };

  /* ================= CREATE ROLE ================= */
  const createRole = async () => {
    if (!roleName.trim()) {
      alert("Role name required");
      return;
    }

    try {
      const response = await fetch(`${API}/roles/addNewRole`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleName,
          description: roleDescription
        })
      });

      const {message} = await response.json();

      if (!response.ok) {
        alert(message || "Failed to create role");
        return;
      }

      alert(message);
      setRoleName("");
      setRoleDescription("");
      loadData();

    } catch (err) {
      alert("Network error while creating role");
      console.error(err);
    }
  };

  /* ================= CREATE PERMISSION ================= */
  const createPermission = async () => {
    if (!permissionName.trim()) {
      alert("Permission name required");
      return;
    }

    try {
      const response = await fetch(`${API}/permissions/addNewPermission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: permissionName,
          description: permissionDescription
        })
      });

      const {message} = await response.json();

      if (!response.ok) {
        alert(message || "Failed to create permission");
        return;
      }

      alert(message);
      setPermissionName("");
      setPermissionDescription("");
      loadData();

    } catch (err) {
      alert("Network error while creating permission");
      console.error(err);
    }
  };

  /* ================= GROUP PERMISSIONS ================= */
  const groupedPermissions = permissions.reduce((acc, perm) => {
    const group = perm.name.includes(".")
      ? perm.name.split(".")[0]
      : "other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(perm);
    return acc;
  }, {});

  /* ================= GET DISPLAY NAME ================= */
  const getDisplayName = (fullName) => {
    if (fullName.includes(".")) {
      const parts = fullName.split(".");
      return parts[parts.length - 1]; // Return the last part after the dot
    }
    return fullName;
  };

  /* ================= TOGGLE GROUP ================= */
  const toggleGroup = (groupPerms, checked) => {
    const ids = groupPerms.map(p => p.id);
    setSelectedPermissionIds(prev =>
      checked
        ? Array.from(new Set([...prev, ...ids]))
        : prev.filter(id => !ids.includes(id))
    );
  };

  /* ================= TOGGLE SINGLE ================= */
  const togglePermission = (id) => {
    setSelectedPermissionIds(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  /* ================= ASSIGN ================= */
  const assignPermissions = async () => {
    if (!selectedRoleId) {
      alert("Please select a role");
      return;
    }

    if (selectedPermissionIds.length === 0) {
      alert("Please select at least one permission");
      return;
    }

    try {
      const response = await fetch(`${API}/role-permission/assignPermissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: selectedRoleId,
          permission_ids: selectedPermissionIds
        })
      });

      const message = await response.text();

      if (!response.ok) {
        alert(message || "Failed to assign permissions");
        return;
      }

      alert(message || "Permissions assigned successfully");
      setSelectedPermissionIds([]);

    } catch (err) {
      alert("Network error while assigning permissions");
      console.error(err);
    }
  };

  return (
    <div className="nr-page">
      <div className="nr-header">
        <h2 className="nr-title">Role & Permission Management</h2>
        <p className="nr-subtitle">
          Create roles, permissions and assign access
        </p>
      </div>

      <div className="nr-grid">
        {/* CREATE ROLE */}
        <div className="nr-card">
          <h3 className="nr-card-title">Create Role</h3>

          <label className="nr-label">Role Name</label>
          <input
            className="nr-input"
            value={roleName}
            onChange={e => setRoleName(e.target.value)}
          />

          <label className="nr-label">Description</label>
          <textarea
            className="nr-textarea"
            value={roleDescription}
            onChange={e => setRoleDescription(e.target.value)}
          />

          <button className="nr-btn-primary" onClick={createRole}>
            Create Role
          </button>
        </div>

        {/* CREATE PERMISSION */}
        <div className="nr-card">
          <h3 className="nr-card-title">Create Permission</h3>

          <label className="nr-label">Permission Name</label>
          <input
            className="nr-input"
            value={permissionName}
            onChange={e => setPermissionName(e.target.value)}
          />

          <label className="nr-label">Description</label>
          <textarea
            className="nr-textarea"
            value={permissionDescription}
            onChange={e => setPermissionDescription(e.target.value)}
          />

          <button className="nr-btn-primary" onClick={createPermission}>
            Create Permission
          </button>
        </div>

        {/* ASSIGN PERMISSIONS */}
        <div className="nr-card nr-card-full">
          <h3 className="nr-card-title">Assign Permissions</h3>

          <label className="nr-label">Select Role</label>
          <select
            className="nr-select"
            value={selectedRoleId}
            onChange={e => setSelectedRoleId(Number(e.target.value))}
          >
            <option value="">Select Role</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          {Object.entries(groupedPermissions).map(([group, perms]) => {
            const allChecked = perms.every(p =>
              selectedPermissionIds.includes(p.id)
            );

            return (
              <div key={group} className="nr-permission-group">
                <label className="nr-group-title">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={e => toggleGroup(perms, e.target.checked)}
                  />
                  {group.toUpperCase()}
                </label>

                <div className="nr-permission-children">
                  {perms.map(p => (
                    <label key={p.id} className="nr-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedPermissionIds.includes(p.id)}
                        onChange={() => togglePermission(p.id)}
                      />
                      {getDisplayName(p.name)}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          <button className="nr-btn-primary" onClick={assignPermissions}>
            Save Permissions
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewRolePermissions;