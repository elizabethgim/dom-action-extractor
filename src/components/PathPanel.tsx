import "@styles/PathPanel.css"
type Props={
  path: string[];
}

export function PathPanel({ path }: Props){

  return (
    <div className="pathPanel">
      <div className="title">
        Paths
      </div>
      <div className="wrap">
        <table>
        <thead>
            <tr>
              <th>#</th>
              <th>Path</th>
            </tr>
          </thead>

          <tbody>
            {path.length === 0 ? (
              <tr>
                <td colSpan={2} className="axisEmptyRow">
                  No path detected
                </td>
              </tr>
            ) : (
              path.map((p, idx) => (
                <tr key={idx}>
                  <td>{idx}</td>
                  <td>{p}</td>
                               
                </tr>
              ))
            )}
          </tbody>
          </table>
      </div>
    </div>
  )
}